import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function generateExamples(directory = 'barzano'): string[] {
  mkdirSync(directory, { recursive: true });
  const files: Record<string, string> = {
    'create-payment.mjs': `import { BarzanoPay } from '@barzano/pay';

const client = new BarzanoPay({ apiKey: process.env.BARZANO_PAY_API_KEY });
const payment = await client.payments.create({
  externalId: 'pedido-' + Date.now(),
  storeId: process.env.BARZANO_STORE_ID,
  amount: 200,
  currency: 'BRL',
  method: 'PIX',
  expiresIn: 1800,
  payer: { name: 'Cliente Teste', email: 'cliente@example.com', taxId: '52998224725' },
}, { idempotencyKey: 'pedido-' + Date.now() });
console.log(payment);
`,
    'verify-webhook.mjs': `import { verifyWebhook } from '@barzano/pay';

export function parseBarzanoWebhook(rawBody, headers) {
  return verifyWebhook({
    payload: rawBody,
    signature: headers['x-webhook-signature'],
    timestamp: headers['x-webhook-timestamp'],
    secret: process.env.BARZANO_WEBHOOK_SECRET,
  });
}
`,
  };
  const created: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name);
    if (!existsSync(path)) {
      writeFileSync(path, content, 'utf8');
      created.push(path);
    }
  }
  return created;
}
