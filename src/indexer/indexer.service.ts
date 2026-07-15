import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from 'stellar-sdk';
import { SupabaseService } from '../database/supabase.client';
import { SorobanService } from '../blockchain/soroban/soroban.service';
import { EventParserService } from './event-parser.service';
import {
  ParsedContractEvent,
  LoanEventType,
  ReputationEventType,
  LoanCreatedPayload,
  LoanRepaidPayload,
  LoanDefaultedPayload,
  ScoreChangedPayload,
} from './interfaces';

/**
 * Blockchain indexer driven by NestJS `@Cron`.
 *
 * On every cycle (every 60 s) it:
 *  1. Reads the last indexed ledger per contract from `indexer_state`.
 *  2. Fetches new Soroban events since that ledger.
 *  3. Parses, deduplicates, and persists them to the database.
 *  4. Updates the cursor so the next run resumes correctly.
 *
 * Previously this ran as a BullMQ repeatable job; it now runs in-process via
 * `@nestjs/schedule` to eliminate the Redis polling overhead.
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  /**
   * Guards against overlapping cycles: if a cycle is still running when the next
   * cron tick fires, the tick is skipped rather than run concurrently.
   */
  private isRunning = false;

  /**
   * How far behind the network head a cursor may fall before we treat it as
   * stale. Soroban RPC only retains contract events for a limited window of
   * recent ledgers; once the cursor drops more than this below the head, the RPC
   * rejects `getEvents` with "startLedger must be within the ledger range".
   */
  private static readonly LEDGER_RETENTION_BUFFER = 100_000;

  /**
   * When a stale cursor is healed, how far below the network head we jump to.
   * A small buffer keeps the catch-up point comfortably inside the retention
   * window so recovery completes in a single cycle.
   */
  private static readonly CATCH_UP_BUFFER = 1_000;

  private readonly loanContractId: string;
  private readonly reputationContractId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly sorobanService: SorobanService,
    private readonly supabaseService: SupabaseService,
    private readonly eventParser: EventParserService,
  ) {
    this.loanContractId =
      this.configService.get<string>('CREDIT_LINE_CONTRACT_ID') || '';
    this.reputationContractId =
      this.configService.get<string>('REPUTATION_CONTRACT_ID') || '';
  }

  // -------------------------------------------------------------------------
  // Cron entry point
  // -------------------------------------------------------------------------

  @Cron('*/60 * * * * *')
  async runIndexer(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Indexer already running, skipping');
      return;
    }
    this.isRunning = true;

    this.logger.log({
      context: 'IndexerService',
      action: 'runIndexer',
    }, 'Blockchain indexer cycle started');

    try {
      await this.indexLoanContract();
      await this.indexReputationContract();
    } catch (error) {
      this.logger.error('Indexer cycle failed', error);
    } finally {
      this.isRunning = false;
    }

    this.logger.log({
      context: 'IndexerService',
      action: 'runIndexer',
    }, 'Blockchain indexer cycle completed');
  }

  /**
   * Indexes the loan contract, isolating its failures so a loan-side error does
   * not prevent the reputation contract from being indexed in the same cycle.
   */
  private async indexLoanContract(): Promise<void> {
    try {
      await this.indexContract(this.loanContractId, 'loan');
    } catch (error) {
      this.logger.error({
        context: 'IndexerService',
        action: 'indexLoanContract',
        error: error.message,
        stack: error.stack,
      }, 'Failed to index loan contract events — will retry next cycle');
    }
  }

  /**
   * Indexes the reputation contract, isolating its failures from the rest of the
   * cycle.
   */
  private async indexReputationContract(): Promise<void> {
    try {
      await this.indexContract(this.reputationContractId, 'reputation');
    } catch (error) {
      this.logger.error({
        context: 'IndexerService',
        action: 'indexReputationContract',
        error: error.message,
        stack: error.stack,
      }, 'Failed to index reputation contract events — will retry next cycle');
    }
  }

  // -------------------------------------------------------------------------
  // Contract indexing
  // -------------------------------------------------------------------------

  private async indexContract(
    contractId: string,
    label: string,
  ): Promise<void> {
    if (!contractId) {
      this.logger.warn(
        `Skipping ${label} contract indexing — contract ID not configured`,
      );
      return;
    }

    const cursor = await this.getCursor(contractId);
    let startLedger = cursor + 1;

    // Proactive self-heal: fast-forward the cursor if it has fallen outside the
    // RPC's event-retention window before we even ask for events.
    startLedger = await this.healStaleCursor(contractId, startLedger, label);

    this.logger.debug({
        context: 'IndexerService',
      contractId: contractId.slice(0, 8) + '...',
      label,
      startLedger,
    }, `Polling for ${label} events from ledger ${startLedger}`);

    let rawEvents: StellarSdk.SorobanRpc.Api.EventResponse[];
    try {
      rawEvents = await this.fetchEvents(contractId, startLedger);
    } catch (error) {
      // Reactive self-heal: the RPC rejected our startLedger as out of range.
      // Correct the cursor from the range in the error and resume next cycle.
      if (await this.recoverFromRangeError(contractId, error, label)) {
        return;
      }
      throw error;
    }

    if (rawEvents.length === 0) {
      this.logger.debug(`No new ${label} events found`);
      return;
    }

    this.logger.log({
      context: 'IndexerService',
      action: 'indexContract',
      label,
      eventCount: rawEvents.length,
    }, `Found ${rawEvents.length} new ${label} event(s)`);

    let maxLedger = cursor;
    let successCount = 0;
    let errorCount = 0;

    for (const rawEvent of rawEvents) {
      try {
        const parsed = this.eventParser.parseEvent(rawEvent);
        if (!parsed) continue;

        await this.persistEvent(parsed);
        successCount++;

        if (parsed.ledgerSequence > maxLedger) {
          maxLedger = parsed.ledgerSequence;
        }

        this.logger.log({
          context: 'IndexerService',
          action: 'eventIndexed',
          eventType: parsed.type,
          eventId: parsed.eventId,
          txHash: parsed.txHash,
          ledger: parsed.ledgerSequence,
          timestamp: new Date().toISOString(),
        }, `Indexed ${parsed.type} event`);
      } catch (error) {
        errorCount++;
        this.logger.error({
          context: 'IndexerService',
          action: 'persistEvent',
          error: error.message,
          eventId: rawEvent?.id,
        }, 'Failed to persist event — skipping');
      }
    }

    // Update cursor to the highest ledger we successfully processed
    if (maxLedger > cursor) {
      await this.updateCursor(contractId, maxLedger);
    }

    this.logger.log({
      context: 'IndexerService',
      action: 'indexContractComplete',
      label,
      successCount,
      errorCount,
    }, `Finished indexing ${label}: ${successCount} ok, ${errorCount} failed`);
  }

  // -------------------------------------------------------------------------
  // Soroban RPC event fetching
  // -------------------------------------------------------------------------

  private async fetchEvents(
    contractId: string,
    startLedger: number,
  ): Promise<StellarSdk.SorobanRpc.Api.EventResponse[]> {
    const server = this.sorobanService.getServer();

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract' as StellarSdk.SorobanRpc.Api.EventType,
          contractIds: [contractId],
        },
      ],
      limit: 100,
    });

    return response.events ?? [];
  }

  // -------------------------------------------------------------------------
  // Event persistence (with idempotency)
  // -------------------------------------------------------------------------

  private async persistEvent(event: ParsedContractEvent): Promise<void> {
    switch (event.type) {
      case LoanEventType.LOAN_CREATED:
        await this.persistLoanCreated(event as ParsedContractEvent<LoanCreatedPayload>);
        break;
      case LoanEventType.LOAN_REPAID:
        await this.persistLoanRepaid(event as ParsedContractEvent<LoanRepaidPayload>);
        break;
      case LoanEventType.LOAN_DEFAULTED:
        await this.persistLoanDefaulted(event as ParsedContractEvent<LoanDefaultedPayload>);
        break;
      case ReputationEventType.SCORE_CHANGED:
      case ReputationEventType.SCORE_UPDATED:
        await this.persistScoreChanged(event as ParsedContractEvent<ScoreChangedPayload>);
        break;
    }
  }

  /**
   * Inserts a new loan record into `loan_index`.
   * Idempotent: `event_id` has a unique constraint — conflicts are ignored.
   */
  private async persistLoanCreated(
    event: ParsedContractEvent<LoanCreatedPayload>,
  ): Promise<void> {
    const { payload } = event;
    const db = this.supabaseService.getServiceRoleClient();

    const { error } = await db.from('loan_index').upsert(
      {
        loan_id: payload.loanId,
        user_wallet: payload.userWallet,
        status: 'active',
        principal_amount: payload.principalAmount,
        interest_amount: payload.interestAmount,
        due_date: payload.dueDate,
        event_id: event.eventId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'event_id', ignoreDuplicates: true },
    );

    if (error) {
      // 23505 = unique_violation — means this event was already indexed (idempotent)
      if (error.code === '23505') {
        this.logger.debug(`Duplicate LOAN_CREATED event ${event.eventId} — skipping`);
        return;
      }
      throw new Error(`Failed to persist LOAN_CREATED: ${error.message}`);
    }
  }

  /**
   * Inserts a payment record and updates the loan's remaining balance.
   * Idempotent: `(tx_hash, loan_id)` has a unique constraint.
   */
  private async persistLoanRepaid(
    event: ParsedContractEvent<LoanRepaidPayload>,
  ): Promise<void> {
    const { payload } = event;
    const db = this.supabaseService.getServiceRoleClient();

    // 1. Insert payment record
    const { error: paymentError } = await db.from('payment_index').insert({
      loan_id: payload.loanId,
      tx_hash: payload.txHash,
      amount: payload.amount,
      paid_at: payload.paidAt,
    });

    if (paymentError) {
      if (paymentError.code === '23505') {
        this.logger.debug(
          `Duplicate LOAN_REPAID event (tx=${payload.txHash}, loan=${payload.loanId}) — skipping`,
        );
        return;
      }
      throw new Error(`Failed to persist LOAN_REPAID payment: ${paymentError.message}`);
    }

    // 2. Update loan_index: reduce the remaining balance proxy
    //    We recalculate from all payments for atomicity
    const { data: payments, error: sumError } = await db
      .from('payment_index')
      .select('amount')
      .eq('loan_id', payload.loanId);

    if (sumError) {
      this.logger.warn(
        `Could not recalculate balance for loan ${payload.loanId}: ${sumError.message}`,
      );
      return;
    }

    const totalPaid = (payments ?? []).reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    // Fetch loan to determine if fully repaid
    const { data: loan } = await db
      .from('loan_index')
      .select('principal_amount, interest_amount')
      .eq('loan_id', payload.loanId)
      .single();

    if (loan) {
      const totalOwed = Number(loan.principal_amount) + Number(loan.interest_amount);
      const newStatus = totalPaid >= totalOwed ? 'paid' : 'active';

      await db
        .from('loan_index')
        .update({
          status: newStatus,
          last_synced_at: new Date().toISOString(),
        })
        .eq('loan_id', payload.loanId);
    }
  }

  /**
   * Updates loan status to `defaulted`.
   * Idempotent: setting status to 'defaulted' is a no-op if already set.
   */
  private async persistLoanDefaulted(
    event: ParsedContractEvent<LoanDefaultedPayload>,
  ): Promise<void> {
    const db = this.supabaseService.getServiceRoleClient();

    const { error } = await db
      .from('loan_index')
      .update({
        status: 'defaulted',
        last_synced_at: new Date().toISOString(),
      })
      .eq('loan_id', event.payload.loanId);

    if (error) {
      throw new Error(`Failed to persist LOAN_DEFAULTED: ${error.message}`);
    }
  }

  /**
   * Inserts a reputation change into `reputation_history` and updates `reputation_cache`.
   * Idempotent: `event_id` has a unique constraint on `reputation_history`.
   */
  private async persistScoreChanged(
    event: ParsedContractEvent<ScoreChangedPayload>,
  ): Promise<void> {
    const { payload } = event;
    const db = this.supabaseService.getServiceRoleClient();

    // 1. Insert history record
    const { error: historyError } = await db.from('reputation_history').insert({
      event_id: event.eventId,
      user_wallet: payload.wallet,
      old_score: payload.oldScore,
      new_score: payload.newScore,
      change_amount: payload.newScore - payload.oldScore,
      reason: payload.reason,
      transaction_hash: event.txHash,
      ledger_sequence: event.ledgerSequence,
    });

    if (historyError) {
      if (historyError.code === '23505') {
        this.logger.debug(`Duplicate reputation event ${event.eventId} — skipping`);
        return;
      }
      throw new Error(`Failed to persist SCORE_CHANGED history: ${historyError.message}`);
    }

    // 2. Update reputation_cache with latest score
    const { error: cacheError } = await db
      .from('reputation_cache')
      .update({
        score: payload.newScore,
        last_synced_at: new Date().toISOString(),
      })
      .eq('wallet_address', payload.wallet);

    if (cacheError) {
      // Non-fatal: cache update failure should not block event processing
      this.logger.warn({
        context: 'IndexerService',
        action: 'updateReputationCache',
        error: cacheError.message,
        wallet: payload.wallet,
      }, 'Failed to update reputation cache — history was saved');
    }
  }

  // -------------------------------------------------------------------------
  // Self-healing cursor recovery
  // -------------------------------------------------------------------------

  /**
   * Returns the current network ledger sequence from the configured Soroban RPC.
   */
  private async getLatestNetworkLedger(): Promise<number> {
    const { sequence } = await this.sorobanService.getServer().getLatestLedger();
    return sequence;
  }

  /**
   * Proactively fast-forwards a stale cursor.
   *
   * A checkpoint that has fallen too far behind the network head would be
   * rejected by the RPC. When that happens we jump close to the network head
   * (leaving a small buffer inside the retention window) so the indexer catches
   * up in a single cycle rather than crawling forward.
   *
   * @returns The ledger the caller should start fetching from.
   */
  private async healStaleCursor(
    contractId: string,
    startLedger: number,
    label: string,
  ): Promise<number> {
    let latestLedger: number;
    try {
      latestLedger = await this.getLatestNetworkLedger();
    } catch (error) {
      // If we cannot read the network head, proceed with the existing cursor;
      // the reactive handler will still catch an out-of-range failure.
      this.logger.warn({
        context: 'IndexerService',
        action: 'healStaleCursor',
        error: error.message,
        label,
      }, 'Could not read latest network ledger — skipping proactive heal');
      return startLedger;
    }

    const minValidLedger =
      latestLedger - IndexerService.LEDGER_RETENTION_BUFFER;

    if (startLedger >= minValidLedger) {
      return startLedger;
    }

    // Too far behind to recover full history from the RPC, so jump close to the
    // network head and catch up in a single cycle.
    const catchUpLedger = latestLedger - IndexerService.CATCH_UP_BUFFER;

    this.logger.warn({
      context: 'IndexerService',
      action: 'healStaleCursor',
      label,
      startLedger,
      catchUpLedger,
      latestLedger,
    }, `Stale cursor detected for ${label}. Jumping from ${startLedger} directly to ${catchUpLedger} (latest: ${latestLedger})`);

    // Persist (catchUpLedger - 1) so the next resume starts exactly at
    // catchUpLedger, matching the cursor+1 semantics used elsewhere.
    await this.updateCursor(contractId, catchUpLedger - 1);
    return catchUpLedger;
  }

  /**
   * Reactively recovers from a "startLedger must be within the ledger range"
   * RPC error by parsing the valid range and resetting the cursor to its lower
   * bound.
   *
   * @returns `true` if the error was a recognised range error and the cursor was
   *          corrected; `false` if the caller should rethrow.
   */
  private async recoverFromRangeError(
    contractId: string,
    error: unknown,
    label: string,
  ): Promise<boolean> {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes('startLedger must be within')) {
      return false;
    }

    const match = message.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) {
      return false;
    }

    const minValidLedger = parseInt(match[1], 10);

    this.logger.warn({
      context: 'IndexerService',
      action: 'recoverFromRangeError',
      label,
      minValidLedger,
    }, `Ledger out of range for ${label}. Auto-correcting cursor to ${minValidLedger}.`);

    // Store (minValidLedger - 1) so the next cycle starts at minValidLedger.
    await this.updateCursor(contractId, minValidLedger - 1);
    return true;
  }

  // -------------------------------------------------------------------------
  // Cursor management
  // -------------------------------------------------------------------------

  /**
   * Reads the last indexed ledger for a contract from `indexer_state`.
   * Returns 0 if no cursor exists (first run).
   */
  async getCursor(contractId: string): Promise<number> {
    const db = this.supabaseService.getServiceRoleClient();

    const { data, error } = await db
      .from('indexer_state')
      .select('last_ledger')
      .eq('contract_id', contractId)
      .single();

    if (error || !data) {
      return 0;
    }

    return Number(data.last_ledger);
  }

  /**
   * Upserts the cursor for a contract to the given ledger sequence.
   */
  async updateCursor(contractId: string, ledger: number): Promise<void> {
    const db = this.supabaseService.getServiceRoleClient();

    const { error } = await db.from('indexer_state').upsert(
      {
        contract_id: contractId,
        last_ledger: ledger,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'contract_id' },
    );

    if (error) {
      this.logger.error({
        context: 'IndexerService',
        action: 'updateCursor',
        error: error.message,
        contractId,
        ledger,
      }, 'Failed to update indexer cursor');
    }
  }
}
