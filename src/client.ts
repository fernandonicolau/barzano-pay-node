import { BarzanoError } from './errors.js';
import type {
  BarzanoEnvironment,
  CreatePaymentInput,
  CreatePaymentOptions,
  Payment,
} from './types.js';

export interface BarzanoPayOptions {
  apiKey: string;
  environment?: BarzanoEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const URLS: Record<BarzanoEnvironment, string> = {
  sandbox: 'https://pay.barzano.com.br',
  production: 'https://pay.barzano.com.br',
};

export class BarzanoPay {
  readonly payments: {
    create: (input: CreatePaymentInput, options: CreatePaymentOptions) => Promise<Payment>;
    retrieve: (paymentId: string, signal?: AbortSignal) => Promise<Payment>;
    list: (externalId?: string, signal?: AbortSignal) => Promise<Payment[]>;
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: BarzanoPayOptions) {
    if (!options.apiKey.trim()) throw new Error('apiKey is required.');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? URLS[options.environment ?? 'sandbox']).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    if (!this.fetchFn) throw new Error('A Fetch API implementation is required.');

    this.payments = {
      create: (input, requestOptions) =>
        this.request<Payment>('/api/v1/payments', {
          method: 'POST',
          body: input,
          ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
          headers: { 'Idempotency-Key': requestOptions.idempotencyKey },
        }),
      retrieve: (paymentId, signal) =>
        this.request<Payment>(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
          ...(signal ? { signal } : {}),
        }),
      list: (externalId, signal) =>
        this.request<Payment[]>(
          `/api/v1/payments${externalId ? `?externalId=${encodeURIComponent(externalId)}` : ''}`,
          { ...(signal ? { signal } : {}) },
        ),
    };
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.barzano.error.v2+json',
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });

      const raw = await response.text();
      const data = raw ? (JSON.parse(raw) as unknown) : null;
      if (!response.ok) throw this.toError(response.status, data);
      return data as T;
    } catch (error) {
      if (error instanceof BarzanoError) throw error;
      if (controller.signal.aborted) {
        throw new BarzanoError('The request timed out or was aborted.', 'REQUEST_ABORTED', 0, null);
      }
      throw new BarzanoError(
        error instanceof Error ? error.message : 'Network request failed.',
        'NETWORK_ERROR',
        0,
        null,
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  private toError(status: number, body: unknown): BarzanoError {
    const value = body as {
      error?: { code?: string; message?: string; requestId?: string; details?: unknown } | string;
      code?: string;
      message?: string;
      requestId?: string;
    } | null;
    const nested = value?.error && typeof value.error === 'object' ? value.error : null;
    return new BarzanoError(
      nested?.message ?? value?.message ?? 'Barzano Pay request failed.',
      nested?.code ?? value?.code ?? `HTTP_${status}`,
      status,
      nested?.requestId ?? value?.requestId ?? null,
      nested?.details,
    );
  }
}
