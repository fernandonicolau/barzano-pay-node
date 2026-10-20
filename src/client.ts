import { BarzanoError } from './errors.js';
import type {
  BarzanoEnvironment,
  CreatePaymentInput,
  CreatePaymentOptions,
  ListPaymentsOptions,
  Payment,
} from './types.js';

export interface BarzanoPayOptions {
  apiKey: string;
  environment?: BarzanoEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  onResponse?: (metadata: BarzanoResponseMetadata) => void;
}

export interface BarzanoResponseMetadata {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string | null;
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
    list: (options?: ListPaymentsOptions | string, signal?: AbortSignal) => Promise<Payment[]>;
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly onResponse?: BarzanoPayOptions['onResponse'];

  constructor(options: BarzanoPayOptions) {
    if (!options.apiKey.trim()) throw new Error('apiKey is required.');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? URLS[options.environment ?? 'sandbox']).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.onResponse = options.onResponse;
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
      list: (options = {}, legacySignal) => {
        const filters: ListPaymentsOptions = typeof options === 'string'
          ? { externalId: options, ...(legacySignal ? { signal: legacySignal } : {}) }
          : options;
        const params = new URLSearchParams();
        for (const key of ['externalId', 'storeId', 'status', 'paymentMethod', 'providerCode'] as const) {
          const value = filters[key];
          if (value) params.set(key, value);
        }
        const query = params.toString();
        return this.request<Payment[]>(`/api/v1/payments${query ? `?${query}` : ''}`, {
          ...(filters.signal ? { signal: filters.signal } : {}),
        });
      },
    };
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const startedAt = Date.now();
    const method = options.method ?? 'GET';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
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
      let data: unknown = null;
      try {
        data = raw ? (JSON.parse(raw) as unknown) : null;
      } catch {
        data = null;
      }
      const requestId = this.requestId(data, response.headers.get('x-request-id'));
      this.notifyResponse({
        method,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      if (!response.ok) throw this.toError(response.status, data, requestId);
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

  private toError(status: number, body: unknown, requestId: string | null): BarzanoError {
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
      nested?.requestId ?? value?.requestId ?? requestId,
      nested?.details,
    );
  }

  private requestId(body: unknown, header: string | null): string | null {
    const value = body as
      | { error?: { requestId?: string } | string; requestId?: string }
      | null;
    const nested = value?.error && typeof value.error === 'object' ? value.error : null;
    return nested?.requestId ?? value?.requestId ?? header;
  }

  private notifyResponse(metadata: BarzanoResponseMetadata): void {
    try {
      this.onResponse?.(metadata);
    } catch {
      // Observability hooks must never change a payment request result.
    }
  }
}
