#!/usr/bin/env node
import { confirm, input, password, select } from '@inquirer/prompts';

import { readEnvFile, writeApiKey, writeEnvValues } from './env-file.js';
import { generateExamples } from './examples.js';
import { OnboardingApi, type ProviderField, type Store } from './onboarding-api.js';

const FALLBACK_TERMS_VERSION = '2026-08-14';
const DOCS_URL = 'https://pay.barzano.com.br/docs';

function extractToken(value: string): string {
  try {
    const url = new URL(value);
    return url.searchParams.get('token') ?? value.trim();
  } catch {
    return value.trim();
  }
}

async function obtainApiKey(api: OnboardingApi): Promise<string | null> {
  const fileEnv = readEnvFile();
  const existing = process.env.BARZANO_PAY_API_KEY ?? fileEnv.BARZANO_PAY_API_KEY;
  if (existing) {
    console.log('✓ Integration key encontrada no ambiente. Login não será necessário.');
    return existing;
  }

  const path = await select({
    message: 'Como deseja continuar?',
    choices: [
      { name: 'Criar uma conta Barzano Pay', value: 'register' },
      { name: 'Entrar em uma conta existente', value: 'login' },
      { name: 'Informar uma integration key', value: 'key' },
      { name: 'Seguir apenas pela documentação', value: 'docs' },
    ],
  });
  if (path === 'docs') {
    console.log(DOCS_URL);
    return null;
  }
  if (path === 'key') return password({ message: 'BARZANO_PAY_API_KEY:', mask: '*' });

  const email = await input({ message: 'E-mail:' });
  const secret = await password({ message: 'Senha:', mask: '*' });
  if (path === 'register') {
    let termsVersion = FALLBACK_TERMS_VERSION;
    try {
      termsVersion = (await api.registrationConfig()).termsVersion;
    } catch {
      console.log(`ℹ Usando a versão de termos publicada ${FALLBACK_TERMS_VERSION}.`);
    }
    const accepted = await confirm({
      message: `Você aceita os termos de uso (${termsVersion})?`,
      default: false,
    });
    if (!accepted) throw new Error('O aceite dos termos é necessário para criar a conta.');
    const result = await api.register({
      tenantName: await input({ message: 'Nome da empresa ou workspace:' }),
      ownerName: await input({ message: 'Seu nome completo:' }),
      ownerEmail: email,
      ownerPhone: await input({ message: 'Telefone:' }),
      ownerCpf: await input({ message: 'CPF:' }),
      password: secret,
      termsAccepted: true,
      termsVersion,
    });
    console.log(
      result.verificationEmailSent
        ? '✓ Conta criada. Enviamos um e-mail de confirmação.'
        : '✓ Conta criada. Solicite o reenvio do e-mail de confirmação.',
    );
    let verified = false;
    while (!verified) {
      const action = await select({
        message: 'Confirme seu e-mail antes de continuar:',
        choices: [
          { name: 'Já confirmei pelo e-mail', value: 'done' },
          { name: 'Colar o link ou token recebido', value: 'token' },
          { name: 'Reenviar e-mail', value: 'resend' },
          { name: 'Continuar depois', value: 'exit' },
        ],
      });
      if (action === 'exit') return null;
      if (action === 'resend') {
        await api.resendVerification(email);
        console.log('✓ Solicitação de reenvio processada.');
        continue;
      }
      if (action === 'token') {
        const token = await password({ message: 'Link ou token:', mask: '*' });
        await api.confirmVerification(extractToken(token));
      }
      try {
        await api.login(email, secret);
        verified = true;
      } catch {
        console.log('O e-mail ainda não foi confirmado. Verifique a mensagem recebida e tente novamente.');
      }
    }
  }

  const session = await api.login(email, secret);
  const created = await api.createApiKey(session.accessToken, 'CLI sandbox');
  console.log('✓ Integration key sandbox criada. O access token humano foi descartado.');
  return created.apiKey;
}

async function collectCredential(field: ProviderField): Promise<string | boolean> {
  const message = field.helpText ? `${field.label} — ${field.helpText}` : field.label;
  if (field.type === 'BOOLEAN') return confirm({ message, default: false });
  if (field.type === 'SELECT') {
    return select({
      message,
      choices: (field.options ?? []).map((option) => ({ name: option.label, value: option.value })),
    });
  }
  if (field.type === 'SECRET') return password({ message, mask: '*' });
  return input({ message, ...(field.placeholder ? { default: field.placeholder } : {}) });
}

function credentialType(field: ProviderField): ProviderField['credentialType'] {
  if (field.credentialType) return field.credentialType;
  if (field.type === 'FILE') return 'CERTIFICATE_REFERENCE';
  if (/client.?id/i.test(field.key)) return 'CLIENT_ID';
  if (/client.?secret/i.test(field.key)) return 'CLIENT_SECRET';
  return 'API_KEY';
}

async function chooseStore(api: OnboardingApi, apiKey: string): Promise<Store> {
  const current = await api.stores(apiKey);
  if (current.data.length) {
    const selection = await select({
      message: 'Escolha uma loja:',
      choices: [
        ...current.data.map((store) => ({ name: `${store.name} (${store.status})`, value: store.id })),
        { name: 'Cadastrar nova loja', value: 'new' },
      ],
    });
    const selected = current.data.find((store) => store.id === selection);
    if (selected) return selected;
  }
  return api.createStore(apiKey, {
    name: await input({ message: 'Nome da loja:' }),
    externalId: await input({ message: 'ID da loja no seu sistema (opcional):' }),
    documentType: await select({
      message: 'Tipo de documento:',
      choices: [
        { name: 'CNPJ', value: 'CNPJ' },
        { name: 'CPF', value: 'CPF' },
      ],
    }),
    document: await input({ message: 'Documento da loja:' }),
    email: await input({ message: 'E-mail da loja (opcional):' }),
    phone: await input({ message: 'Telefone da loja (opcional):' }),
  });
}

async function configureProvider(api: OnboardingApi, apiKey: string, store: Store): Promise<void> {
  const providers = await api.providers(apiKey);
  if (!providers.length) {
    console.log('Nenhum provedor está disponível para esta conta.');
    return;
  }
  const providerCode = await select({
    message: 'Provedor de pagamento:',
    choices: providers.map((provider) => ({
      name: `${provider.displayName} — ${provider.capabilities.supportedPaymentMethods.join(', ')}`,
      value: provider.provider,
    })),
  });
  const schema = await api.providerSchema(apiKey, providerCode);
  console.log(`\n${schema.description}`);
  for (const step of [...schema.steps].sort((a, b) => a.order - b.order)) {
    console.log(`${step.order}. ${step.title}: ${step.description}`);
  }
  const credentials = [];
  for (const field of schema.fields) {
    const value = await collectCredential(field);
    if (field.required || value !== '') {
      credentials.push({
        credentialType: credentialType(field),
        keyName: field.key,
        value: String(value),
      });
    }
  }
  const environment = await select({
    message: 'Ambiente da conta:',
    choices: schema.supportedEnvironments.map((value) => ({ name: value, value })),
  });
  const holderType = await select({
    message: 'Documento do titular:',
    choices: [
      { name: 'CNPJ', value: 'CNPJ' },
      { name: 'CPF', value: 'CPF' },
    ],
  });
  const account = await api.createProviderAccount(apiKey, store.id, {
    providerCode,
    label: await input({ message: 'Nome desta conta:', default: `${schema.displayName} principal` }),
    accountHolderDocument: await input({ message: 'Documento do titular da conta:' }),
    accountHolderDocumentType: holderType,
    accountHolderName: await input({ message: 'Nome do titular:' }),
    ownershipType: 'STORE',
    environment,
    credentials,
  });
  await api.validateProviderAccount(apiKey, store.id, account.id);
  await api.activateProviderAccount(apiKey, store.id, account.id);
  console.log(`✓ ${schema.displayName} validado e ativado para ${store.name}.`);
}

async function doctor(api: OnboardingApi, apiKey: string): Promise<void> {
  const providers = await api.providers(apiKey);
  const stores = await api.stores(apiKey);
  console.log('✓ API acessível');
  console.log('✓ Integration key válida');
  console.log(`✓ ${providers.length} provedor(es) disponível(is)`);
  console.log(`${stores.total ? '✓' : '⚠'} ${stores.total} loja(s) cadastrada(s)`);
}

async function init(): Promise<void> {
  console.log('\nBarzano Pay — configuração assistida\n');
  const api = new OnboardingApi(process.env.BARZANO_PAY_BASE_URL);
  const apiKey = await obtainApiKey(api);
  if (!apiKey) return;
  await doctor(api, apiKey);
  let savedEnvironment = false;
  if (await confirm({ message: 'Salvar a integration key no arquivo .env?', default: true })) {
    writeApiKey(apiKey);
    savedEnvironment = true;
    console.log('✓ Chave salva em .env. Não versione esse arquivo.');
  }
  const next = await select({
    message: 'Próximo passo:',
    choices: [
      { name: 'Cadastrar loja e conectar provedor', value: 'provider' },
      { name: 'Gerar exemplos no projeto', value: 'examples' },
      { name: 'Seguir pela documentação', value: 'docs' },
      { name: 'Encerrar', value: 'exit' },
    ],
  });
  if (next === 'provider') {
    const store = await chooseStore(api, apiKey);
    if (savedEnvironment) writeEnvValues({ BARZANO_STORE_ID: store.id });
    await configureProvider(api, apiKey, store);
    const files = generateExamples();
    console.log(files.length ? `✓ Exemplos criados: ${files.join(', ')}` : 'ℹ Exemplos já existentes.');
  } else if (next === 'examples') {
    console.log(`✓ Exemplos criados: ${generateExamples().join(', ')}`);
  } else if (next === 'docs') {
    console.log(DOCS_URL);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'init';
  const api = new OnboardingApi(process.env.BARZANO_PAY_BASE_URL);
  if (command === 'init') return init();
  if (command === 'doctor') {
    const env = readEnvFile();
    const apiKey = process.env.BARZANO_PAY_API_KEY ?? env.BARZANO_PAY_API_KEY;
    if (!apiKey) throw new Error('Defina BARZANO_PAY_API_KEY ou execute `barzano init`.');
    return doctor(api, apiKey);
  }
  if (command === 'providers') {
    const env = readEnvFile();
    const apiKey = process.env.BARZANO_PAY_API_KEY ?? env.BARZANO_PAY_API_KEY;
    if (!apiKey) throw new Error('Defina BARZANO_PAY_API_KEY ou execute `barzano init`.');
    for (const provider of await api.providers(apiKey)) {
      console.log(`${provider.displayName}: ${provider.capabilities.supportedPaymentMethods.join(', ')}`);
    }
    return;
  }
  throw new Error(`Comando desconhecido: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `Erro: ${error.message}` : 'Erro inesperado.');
  process.exitCode = 1;
});
