import { BarzanoError } from './errors.js';

export interface RegistrationInput {
  tenantName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerCpf: string;
  password: string;
  termsAccepted: true;
  termsVersion: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface ProviderField {
  key: string;
  credentialType?: 'API_KEY' | 'CLIENT_ID' | 'CLIENT_SECRET' | 'CERTIFICATE_REFERENCE';
  label: string;
  type: 'TEXT' | 'SECRET' | 'FILE' | 'SELECT' | 'BOOLEAN';
  required: boolean;
  sensitive: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface ProviderCatalogEntry {
  provider: string;
  displayName: string;
  description: string;
  supportedEnvironments: Array<'SANDBOX' | 'PRODUCTION'>;
  capabilities: {
    supportedPaymentMethods: string[];
  };
}

export interface ProviderSchema extends ProviderCatalogEntry {
  fields: ProviderField[];
  steps: Array<{ order: number; title: string; description: string }>;
}

export interface StoreInput {
  externalId?: string;
  name: string;
  legalName?: string;
  documentType: 'CPF' | 'CNPJ';
  document: string;
  email?: string;
  phone?: string;
}

export interface Store { id: string; name: string; status: string }

export class OnboardingApi {
  constructor(
    readonly baseUrl = 'https://pay.barzano.com.br',
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {}

  registrationConfig(): Promise<{ termsVersion: string }> {
    return this.request('/api/v1/auth/registration-config');
  }

  register(input: RegistrationInput): Promise<{ verificationEmailSent: boolean }> {
    return this.request('/api/v1/auth/register', { method: 'POST', body: input });
  }

  resendVerification(email: string): Promise<void> {
    return this.request('/api/v1/auth/email-verification/send', {
      method: 'POST',
      body: { email },
    });
  }

  confirmVerification(token: string): Promise<void> {
    return this.request('/api/v1/auth/email-verification/confirm', {
      method: 'POST',
      body: { token },
    });
  }

  login(email: string, password: string): Promise<Session> {
    return this.request('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  }

  createApiKey(accessToken: string, name: string): Promise<{ apiKey: string }> {
    return this.request('/api/v1/api-credentials', {
      method: 'POST',
      token: accessToken,
      body: { name, environment: 'SANDBOX' },
    });
  }

  providers(apiKey: string): Promise<ProviderCatalogEntry[]> {
    return this.request('/api/v1/providers', { apiKey });
  }

  providerSchema(apiKey: string, provider: string): Promise<ProviderSchema> {
    return this.request(`/api/v1/providers/${encodeURIComponent(provider)}/schema`, { apiKey });
  }

  stores(apiKey: string): Promise<{ data: Store[]; total: number }> {
    return this.request('/api/v1/stores?limit=100', { apiKey });
  }

  createStore(apiKey: string, input: StoreInput): Promise<Store> {
    return this.request('/api/v1/stores', { method: 'POST', apiKey, body: input });
  }

  createProviderAccount(
    apiKey: string,
    storeId: string,
    input: Record<string, unknown>,
  ): Promise<{ id: string; status: string }> {
    return this.request(`/api/v1/stores/${encodeURIComponent(storeId)}/provider-accounts`, {
      method: 'POST',
      apiKey,
      body: input,
    });
  }

  validateProviderAccount(apiKey: string, storeId: string, accountId: string): Promise<unknown> {
    return this.request(
      `/api/v1/stores/${encodeURIComponent(storeId)}/provider-accounts/${encodeURIComponent(accountId)}/validate`,
      { method: 'POST', apiKey },
    );
  }

  activateProviderAccount(apiKey: string, storeId: string, accountId: string): Promise<unknown> {
    return this.request(
      `/api/v1/stores/${encodeURIComponent(storeId)}/provider-accounts/${encodeURIComponent(accountId)}/activate`,
      { method: 'POST', apiKey },
    );
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; token?: string; apiKey?: string } = {},
  ): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? (JSON.parse(raw) as unknown) : undefined;
    } catch {
      body = raw || undefined;
    }
    if (!response.ok) {
      const value = body as { error?: { code?: string; message?: string }; message?: string };
      throw new BarzanoError(
        (typeof value?.error === 'object' ? value.error.message : undefined) ??
          value?.message ??
          `Request failed with HTTP ${response.status}.`,
        (typeof value?.error === 'object' ? value.error.code : undefined) ?? `HTTP_${response.status}`,
        response.status,
        null,
        body,
      );
    }
    return body as T;
  }
}
