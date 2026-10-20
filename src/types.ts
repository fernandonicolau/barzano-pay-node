export type BarzanoEnvironment = 'sandbox' | 'production';
export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type PaymentStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'WAITING_PAYMENT'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'EXPIRED';

export interface Customer {
  name: string;
  email: string;
  taxId: string;
}

export interface CreatePaymentInput {
  externalId: string;
  storeId: string;
  amount: number;
  currency?: 'BRL';
  method: PaymentMethod;
  description?: string;
  expiresAt?: string;
  customer: Customer;
  providerCode?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreatePaymentOptions {
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface ListPaymentsOptions {
  externalId?: string;
  storeId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  providerCode?: string;
  signal?: AbortSignal;
}

export interface PaymentInstructions {
  type: PaymentMethod;
  copyAndPaste?: string;
  qrCode?: string;
  expiresAt?: string;
  barcode?: string;
  digitableLine?: string;
  documentUrl?: string;
}

export interface Payment {
  id: string;
  chargeId?: string;
  externalId: string;
  storeId?: string;
  paymentAccountId?: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method?: PaymentMethod;
  paymentMethod?: PaymentMethod;
  expiresAt?: string | null;
  pix?: { copyAndPaste: string; qrCode: string } | null;
  paymentInstructions?: PaymentInstructions | null;
  provider?: {
    code?: string;
    name?: string;
    chargeId?: string | null;
    referenceId?: string | null;
    status?: string | null;
  } | null;
  nextAction?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface BarzanoWebhookEvent<T = Record<string, unknown>> {
  id?: string;
  type: string;
  createdAt?: string;
  data: T;
  [key: string]: unknown;
}
