import type { CreditCardOptions } from './types.js';

const MERCADO_PAGO_SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const PAGBANK_SDK_URL = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';

export type EmbeddedCardProvider = 'MERCADO_PAGO' | 'PAGBANK';

export interface EmbeddedCardResult {
  providerCode: EmbeddedCardProvider;
  creditCard: CreditCardOptions & { checkoutMode: 'EMBEDDED' };
  display?: {
    brand?: string;
    lastFour?: string;
  };
}

export class EmbeddedCardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddedCardError';
  }
}

interface MercadoPagoBrickController {
  unmount(): void | Promise<void>;
}

interface MercadoPagoBrickSettings {
  initialization: { amount: number };
  customization: {
    paymentMethods: {
      creditCard: 'all';
      debitCard: 'none';
      prepaidCard: 'none';
    };
  };
  callbacks: {
    onReady(): void;
    onSubmit(data: MercadoPagoSubmitData): Promise<void>;
    onError(error: unknown): void;
  };
}

interface MercadoPagoSubmitData {
  token?: string;
  payment_method_id?: string;
  installments?: number | string;
  issuer_id?: string;
  payer?: unknown;
}

interface MercadoPagoSdk {
  bricks(): {
    create(
      type: 'cardPayment',
      containerId: string,
      settings: MercadoPagoBrickSettings,
    ): Promise<MercadoPagoBrickController>;
  };
}

interface MercadoPagoConstructor {
  new(publicKey: string, options?: { locale?: string }): MercadoPagoSdk;
}

interface PagBankEncryptResult {
  encryptedCard?: string;
  hasErrors: boolean;
  errors?: Array<{ code?: string; message?: string }>;
}

interface PagBankSdk {
  encryptCard(input: PagBankCardData & { publicKey: string }): PagBankEncryptResult;
}

export interface PagBankCardData {
  holder: string;
  number: string;
  expMonth: string;
  expYear: string;
  securityCode: string;
}

export interface PagBankEncryptOptions extends PagBankCardData {
  publicKey: string;
  installments?: number;
  sdk?: PagBankSdk;
}

export interface MercadoPagoCardOptions {
  publicKey: string;
  /** Element id without `#`. */
  containerId: string;
  /** Payment amount in integer cents. */
  amount: number;
  locale?: string;
  onReady?(): void;
  onSubmit(result: EmbeddedCardResult): void | Promise<void>;
  onError?(error: EmbeddedCardError): void;
  sdk?: MercadoPagoSdk;
}

export interface EmbeddedCardController {
  unmount(): Promise<void>;
}

type BrowserGlobal = typeof globalThis & {
  MercadoPago?: MercadoPagoConstructor;
  PagSeguro?: PagBankSdk;
};

const scriptPromises = new Map<string, Promise<void>>();

function assertPublicKey(publicKey: string): void {
  if (publicKey.trim().length === 0) {
    throw new EmbeddedCardError('PUBLIC_KEY_REQUIRED', 'Informe a chave pública do provider.');
  }
}

function normalizeInstallments(value: number | string | undefined): number {
  const installments = Number(value ?? 1);
  if (!Number.isInteger(installments) || installments < 1) {
    throw new EmbeddedCardError('INVALID_INSTALLMENTS', 'A quantidade de parcelas é inválida.');
  }
  return installments;
}

function loadScript(url: string, isReady: () => boolean): Promise<void> {
  if (isReady()) return Promise.resolve();
  if (typeof document === 'undefined') {
    return Promise.reject(new EmbeddedCardError('BROWSER_REQUIRED', 'Este recurso deve ser usado no navegador.'));
  }

  const existing = scriptPromises.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (isReady()) resolve();
      else reject(new EmbeddedCardError('PROVIDER_SDK_UNAVAILABLE', 'O SDK do provider não foi inicializado.'));
    };
    script.onerror = () => reject(new EmbeddedCardError('PROVIDER_SDK_LOAD_FAILED', 'Não foi possível carregar o SDK do provider.'));
    document.head.append(script);
  });
  scriptPromises.set(url, promise);
  promise.catch(() => scriptPromises.delete(url));
  return promise;
}

function sanitizeError(error: unknown): EmbeddedCardError {
  if (error instanceof EmbeddedCardError) return error;
  return new EmbeddedCardError('PROVIDER_SDK_ERROR', 'O provider não conseguiu processar os dados do cartão.');
}

/**
 * Mounts Mercado Pago's official Card Payment Brick. Card data stays inside the provider SDK.
 */
export async function mountMercadoPagoCard(options: MercadoPagoCardOptions): Promise<EmbeddedCardController> {
  assertPublicKey(options.publicKey);
  if (!Number.isSafeInteger(options.amount) || options.amount < 1) {
    throw new EmbeddedCardError('INVALID_AMOUNT', 'Informe o valor do pagamento em centavos.');
  }

  let sdk = options.sdk;
  if (!sdk) {
    const browser = globalThis as BrowserGlobal;
    await loadScript(MERCADO_PAGO_SDK_URL, () => typeof browser.MercadoPago === 'function');
    const Constructor = browser.MercadoPago;
    if (!Constructor) throw new EmbeddedCardError('PROVIDER_SDK_UNAVAILABLE', 'MercadoPago.js indisponível.');
    sdk = new Constructor(options.publicKey, { locale: options.locale ?? 'pt-BR' });
  }

  try {
    const controller = await sdk.bricks().create('cardPayment', options.containerId, {
      initialization: { amount: options.amount / 100 },
      customization: {
        paymentMethods: { creditCard: 'all', debitCard: 'none', prepaidCard: 'none' },
      },
      callbacks: {
        onReady: () => options.onReady?.(),
        onSubmit: async (data) => {
          try {
            if (!data.token || !data.payment_method_id) {
              throw new EmbeddedCardError('INVALID_PROVIDER_RESULT', 'O provider não devolveu um token de cartão válido.');
            }
            await options.onSubmit({
              providerCode: 'MERCADO_PAGO',
              creditCard: {
                checkoutMode: 'EMBEDDED',
                token: data.token,
                paymentMethodId: data.payment_method_id,
                installments: normalizeInstallments(data.installments),
              },
              display: { brand: data.payment_method_id },
            });
          } catch (error) {
            const safeError = sanitizeError(error);
            options.onError?.(safeError);
            throw safeError;
          }
        },
        onError: (error) => options.onError?.(sanitizeError(error)),
      },
    });

    return { unmount: async () => void (await controller.unmount()) };
  } catch (error) {
    throw sanitizeError(error);
  }
}

/**
 * Encrypts a card locally with PagBank's official browser SDK. Call only from the submit handler
 * and discard the raw form values immediately after this function returns.
 */
export async function encryptPagBankCard(options: PagBankEncryptOptions): Promise<EmbeddedCardResult> {
  assertPublicKey(options.publicKey);
  let sdk = options.sdk;
  if (!sdk) {
    const browser = globalThis as BrowserGlobal;
    await loadScript(PAGBANK_SDK_URL, () => typeof browser.PagSeguro?.encryptCard === 'function');
    sdk = browser.PagSeguro;
  }
  if (!sdk) throw new EmbeddedCardError('PROVIDER_SDK_UNAVAILABLE', 'SDK do PagBank indisponível.');

  const result = sdk.encryptCard({
    publicKey: options.publicKey,
    holder: options.holder,
    number: options.number,
    expMonth: options.expMonth,
    expYear: options.expYear,
    securityCode: options.securityCode,
  });
  if (result.hasErrors || !result.encryptedCard) {
    const code = result.errors?.[0]?.code ?? 'CARD_ENCRYPTION_FAILED';
    throw new EmbeddedCardError(code, 'O PagBank não conseguiu validar ou criptografar o cartão.');
  }

  return {
    providerCode: 'PAGBANK',
    creditCard: {
      checkoutMode: 'EMBEDDED',
      encrypted: result.encryptedCard,
      installments: normalizeInstallments(options.installments),
    },
  };
}
