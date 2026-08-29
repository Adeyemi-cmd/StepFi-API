import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthWalletThrottlerGuard } from '../../../../src/modules/auth/auth-throttler.guard';
import { buildTestApp, InMemoryStore } from '../../helpers/test-setup';

// Use the real stellar-sdk implementation even when a manual mock exists at
// test/__mocks__/stellar-sdk.js (which is auto-applied for `jest.mock` in
// unit tests). `jest.requireActual` bypasses the mock and gives us a
// Keypair that generates distinct random wallets per call.
const { Keypair: RealKeypair } = jest.requireActual('stellar-sdk') as typeof import('stellar-sdk');
type RealKeypairType = InstanceType<typeof RealKeypair>;
function createTestKeypair(): RealKeypairType {
  return RealKeypair.random() as unknown as RealKeypairType;
}
function signMessage(keypair: RealKeypairType, message: string): string {
  return (keypair as unknown as { sign: (b: Buffer) => Buffer }).sign(Buffer.from(message)).toString('base64');
}

/**
 * E2E coverage for the two gaps identified by the audit bot:
 *  - atomic nonce consumption under genuine concurrency (parallel identical
 *    POST /auth/verify must yield exactly one 200, the other 401)
 *  - per-wallet throttling on POST /auth/verify (6 rapid requests from the
 *    same wallet must yield 429 on the 6th)
 *
 * Uses the InMemoryStore mock (via buildTestApp) rather than a real Postgres
 * instance. The store's UPDATE ... is('used_at', null) predicate is evaluated
 * in-memory, so the second concurrent claim correctly sees count 0 / empty
 * data and is rejected as AUTH_NONCE_NOT_FOUND. This is the user-visible
 * contract even though the underlying atomicity is ultimately provided by
 * Postgres `UPDATE ... WHERE used_at IS NULL` in production.
 */
describe('Auth verify — atomic claim & per-wallet throttling (e2e)', () => {
  let app: INestApplication;
  let mockDb: InMemoryStore;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    mockDb = built.mockDb;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDb.clear();
    AuthWalletThrottlerGuard.clearStorage();
  });

  it('parallel double-verify with same (wallet, nonce, signature) yields exactly one success (atomic claim)', async () => {
    const keypair = createTestKeypair();
    const wallet = keypair.publicKey();

    const nonceRes = await request(app.getHttpServer())
      .post('/auth/nonce')
      .send({ wallet })
      .expect(201);

    const nonce: string = nonceRes.body.nonce;
    expect(nonce).toHaveLength(64);

    // Legacy raw scheme: signature over the nonce hex bytes.
    const signature = signMessage(keypair, nonce);

    const results = await Promise.allSettled([
      request(app.getHttpServer()).post('/auth/verify').send({ wallet, nonce, signature }),
      request(app.getHttpServer()).post('/auth/verify').send({ wallet, nonce, signature }),
    ]);

    // supertest always fulfills; inspect HTTP status directly
    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? (r.value as request.Response).status : 0,
    );

    const successes = statuses.filter((s) => s === 200);
    const notFounds = statuses.filter((s) => s === 401);

    expect(successes).toHaveLength(1);
    expect(notFounds).toHaveLength(1);

    // A third sequential replay must also fail with 401 (nonce stays burned)
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
      .expect(401);
  });

  it('expired nonce is rejected and stays burned — second attempt is NOT_FOUND, not success', async () => {
    const keypair = createTestKeypair();
    const wallet = keypair.publicKey();

    const nonceRes = await request(app.getHttpServer())
      .post('/auth/nonce')
      .send({ wallet })
      .expect(201);

    const nonce: string = nonceRes.body.nonce;
    const signature = signMessage(keypair, nonce);

    // Manually expire the nonce row in the mock store (bulk update via store)
    // The mock store holds rows in memory; find and mutate.
    const rows = mockDb.dump('nonces');
    const row = rows.find((r) => r.nonce === nonce);
    if (row) {
      row.expires_at = new Date(Date.now() - 1000).toISOString();
    }

    // First verify: claim succeeds but expiry check fails -> 401 AUTH_NONCE_EXPIRED
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
      .expect(401);

    // Second verify: nonce already claimed/burned -> 401 AUTH_NONCE_NOT_FOUND
    // (burn-on-failure semantics)
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
      .expect(401);
  });

  it('per-wallet throttling: 6 rapid POST /auth/verify from the same wallet yields 429 on the 6th', async () => {
    const wallet = createTestKeypair().publicKey();
    const fakeNonce = 'a'.repeat(64);
    const fakeSig = Buffer.alloc(64).toString('base64');

    // First 5 requests: throttler allows them (service returns 401 AUTH_NONCE_NOT_FOUND,
    // but throttler does not block)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ wallet, nonce: fakeNonce, signature: fakeSig })
        .expect(401);
    }

    // 6th request from same wallet: per-wallet guard must reject with 429
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet, nonce: fakeNonce, signature: fakeSig })
      .expect(429);
  });

  it('per-wallet throttling is isolated — a different wallet is not throttled by the first wallet’s quota', async () => {
    const walletA = createTestKeypair().publicKey();
    const walletB = createTestKeypair().publicKey();
    const fakeNonce = 'b'.repeat(64);
    const fakeSig = Buffer.alloc(64).toString('base64');

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ wallet: walletA, nonce: fakeNonce, signature: fakeSig })
        .expect(401);
    }
    // walletA exhausted
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet: walletA, nonce: fakeNonce, signature: fakeSig })
      .expect(429);

    // walletB should still be allowed (gets 401, not 429)
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ wallet: walletB, nonce: fakeNonce, signature: fakeSig })
      .expect(401);
  });
});
