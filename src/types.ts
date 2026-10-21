export type BarzanoEnvironment = 'sandbox' | 'production';
export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type PaymentStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'WAITING_PAYMENT'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELED'
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

export type BarzanoWebhookEventType =
  | 'charge.paid'
  | 'charge.expired'
  | 'charge.failed'
  | 'webhook.test';

export interface BarzanoChargeWebhookData {
  chargeId: string;
  externalId: string;
  storeExternalId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
}

export interface BarzanoWebhookEvent<T = BarzanoChargeWebhookData> {
  id: string;
  type: BarzanoWebhookEventType;
  createdAt: string;
  data: T;
}

export type BarzanoChargeWebhookEvent = BarzanoWebhookEvent<BarzanoChargeWebhookData> & {
  type: Exclude<BarzanoWebhookEventType, 'webhook.test'>;
};

export interface BarzanoTestWebhookData {
  chargeId: null;
  externalId: string;
  storeExternalId: null;
  amount: 0;
  currency: 'BRL';
  status: 'TEST';
  paidAt: null;
}

export type BarzanoTestWebhookEvent = BarzanoWebhookEvent<BarzanoTestWebhookData> & {
  type: 'webhook.test';
};

export type BarzanoAnyWebhookEvent = BarzanoChargeWebhookEvent | BarzanoTestWebhookEvent;
