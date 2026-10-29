export type BarzanoEnvironment = 'sandbox' | 'production';
export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type PaymentStatus =
  | 'CREATED' | 'PROCESSING' | 'WAITING_PAYMENT' | 'PAID' | 'FAILED'
  | 'CANCELED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'EXPIRED';

/** Stable public error codes returned by payment cancellation. */
export type PaymentCancellationErrorCode =
  | 'PAID_CHARGE_CANNOT_BE_CANCELED'
  | 'CANCEL_TIMEOUT_RECONCILIATION_REQUIRED';

export interface Payer {
  name: string;
  email: string;
  /** CPF (11 digits) or CNPJ (14 digits), without punctuation. */
  taxId: string;
}

export interface PaymentAddress {
  street: string;
  number: string;
  locality: string;
  city: string;
  region: string;
  regionCode: string;
  country: string;
  postalCode: string;
}

export interface BoletoOptions {
  /** Due date in YYYY-MM-DD format. */
  dueDate: string;
  holderAddress: PaymentAddress;
}

export interface CreditCardOptions {
  encrypted?: string;
  token?: string;
  savedPaymentMethodId?: string;
  installments?: number;
  save?: boolean;
}

interface CreatePaymentBase {
  externalId: string;
  storeId: string;
  amount: number;
  currency: 'BRL';
  description?: string;
  /** Expiration in seconds (1 to 2,592,000). */
  expiresIn?: number;
  payer: Payer;
  /** Provider returned by providers.list(). Omit to use the primary eligible account. */
  providerCode?: string;
  /** Exact payment account reference. Takes precedence over automatic account routing. */
  paymentAccountReference?: string;
  metadata?: Record<string, unknown>;
}

export type CreatePaymentInput =
  | (CreatePaymentBase & { method: 'PIX'; boleto?: never; creditCard?: never })
  | (CreatePaymentBase & { method: 'BOLETO'; boleto: BoletoOptions; creditCard?: never })
  | (CreatePaymentBase & { method: 'CREDIT_CARD'; creditCard: CreditCardOptions; boleto?: never });

/** @deprecated Use Payer. */
export type Customer = Payer;

/** @deprecated Use CreatePaymentInput with payer and expiresIn. */
export type LegacyCreatePaymentInput = Omit<CreatePaymentBase, 'payer' | 'expiresIn'> & {
  method: PaymentMethod;
  customer: Customer;
  expiresAt?: string;
  expiresIn?: number;
  payer?: never;
  boleto?: BoletoOptions;
  creditCard?: CreditCardOptions;
};

export type CreatePaymentRequest = CreatePaymentInput | LegacyCreatePaymentInput;

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

export interface RefundPaymentOptions {
  /** Partial refund value in cents. Omit for a full refund. */
  amount?: number;
  /** Required for partial refunds. Reuse it only when retrying the same logical refund. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface PixPaymentInstructions {
  type: 'PIX';
  copyAndPaste: string;
  qrCode: string;
  expiresAt: string | null;
}

export interface BoletoPaymentInstructions {
  type: 'BOLETO';
  barcode: string;
  digitableLine: string;
  documentUrl: string;
  dueDate: string | null;
}

export interface CardPaymentInstructions {
  type: 'CARD';
  authorizationCode: string | null;
}

export type PaymentInstructions =
  | PixPaymentInstructions
  | BoletoPaymentInstructions
  | CardPaymentInstructions;

export interface PaymentProviderResponse {
  code: string;
  name: string;
  chargeId: string | null;
  referenceId: string | null;
  status: string | null;
}

export type PaymentNextAction =
  | { type: 'NONE' }
  | { type: 'DISPLAY_QR_CODE'; qrCode: string; qrCodeImageUrl: string; expiresAt: string | null }
  | {
      type: 'DISPLAY_BOLETO';
      barcode: string;
      digitableLine: string;
      documentUrl: string;
      expiresAt: string | null;
    };

export interface PaymentResponse {
  id: string;
  /** @deprecated Use id. Kept while the legacy charge contract is supported. */
  chargeId: string;
  externalId: string;
  status: PaymentStatus;
  amount: number;
  currency: 'BRL';
  method: PaymentMethod;
  /** @deprecated Use method. */
  paymentMethod: PaymentMethod;
  expiresAt: string | null;
  pix: { copyAndPaste: string; qrCode: string } | null;
  paymentInstructions: PaymentInstructions | null;
  provider: PaymentProviderResponse;
  nextAction: PaymentNextAction;
}

/** @deprecated Use PaymentResponse. */
export type Payment = PaymentResponse;

export type FinancialWebhookEventType = 'charge.paid' | 'charge.expired' | 'charge.failed';
export type WebhookEventType = FinancialWebhookEventType | 'webhook.test';

export interface PaymentWebhookData {
  chargeId: string;
  externalId: string;
  storeExternalId: string | null;
  amount: number;
  currency: 'BRL';
  status: PaymentStatus;
  paidAt: string | null;
}

export interface TestWebhookData {
  chargeId: null;
  externalId: string;
  storeExternalId: null;
  amount: 0;
  currency: 'BRL';
  status: 'TEST';
  paidAt: null;
}

export interface WebhookEvent<TType extends string, TData> {
  id: string;
  type: TType;
  createdAt: string;
  data: TData;
}

export type PaymentWebhookEvent = WebhookEvent<FinancialWebhookEventType, PaymentWebhookData>;
export type TestWebhookEvent = WebhookEvent<'webhook.test', TestWebhookData>;
export type AnyWebhookEvent = PaymentWebhookEvent | TestWebhookEvent;

/** @deprecated Use WebhookEvent. */
export type BarzanoWebhookEvent<T = PaymentWebhookData> = WebhookEvent<WebhookEventType, T>;
/** @deprecated Use WebhookEventType. */
export type BarzanoWebhookEventType = WebhookEventType;
/** @deprecated Use PaymentWebhookData. */
export type BarzanoChargeWebhookData = PaymentWebhookData;
/** @deprecated Use PaymentWebhookEvent. */
export type BarzanoChargeWebhookEvent = PaymentWebhookEvent;
/** @deprecated Use TestWebhookData. */
export type BarzanoTestWebhookData = TestWebhookData;
/** @deprecated Use TestWebhookEvent. */
export type BarzanoTestWebhookEvent = TestWebhookEvent;
/** @deprecated Use AnyWebhookEvent. */
export type BarzanoAnyWebhookEvent = AnyWebhookEvent;
