export enum DineInSessionStatus {
  ACTIVE = 'ACTIVE',
  BILL_REQUESTED = 'BILL_REQUESTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const ACTIVE_DINE_IN_SESSION_STATUSES = [
  DineInSessionStatus.ACTIVE,
  DineInSessionStatus.BILL_REQUESTED,
  DineInSessionStatus.PAYMENT_PENDING,
  DineInSessionStatus.PAID,
] as const;
