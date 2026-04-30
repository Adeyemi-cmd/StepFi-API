export type ReminderType = 'payment_reminder_3d' | 'payment_reminder_1d' | 'payment_overdue';

export interface ActiveLoan {
  id: string;
  loan_id: string;
  user_wallet: string;
  merchant_id: string | null;
  amount: string;
  loan_amount: string;
  next_payment_due: string | null;
  remaining_balance: string;
  term: number;
}

export interface MerchantInfo {
  id: string;
  name: string;
}

export interface ReminderCandidate {
  loan: ActiveLoan;
  reminderType: ReminderType;
  daysUntilDue: number;
}

export interface ReminderSummary {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  breakdown: Record<ReminderType, number>;
}
