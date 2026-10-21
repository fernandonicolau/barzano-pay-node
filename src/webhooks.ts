import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AnyWebhookEvent, WebhookEvent } from './types.js';

export interface VerifyWebhookInput {
  payload: string | Uint8Array;
  signature: string;
  timestamp: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}

function bytes(value: string): Buffer {
  const normalized = value.startsWith('sha256=') ? value.slice(7) : value;
  if (!/^[a-f\d]{64}$/i.test(normalized)) throw new Error('Invalid webhook signature format.');
  return Buffer.from(normalized, 'hex');
}

export function verifyWebhook(input: VerifyWebhookInput): AnyWebhookEvent;
export function verifyWebhook<TType extends string, TData>(
  input: VerifyWebhookInput,
): WebhookEvent<TType, TData>;
export function verifyWebhook<TType extends string, TData>(
  input: VerifyWebhookInput,
): WebhookEvent<TType, TData> {
  const payload =
    typeof input.payload === 'string' ? input.payload : Buffer.from(input.payload).toString('utf8');
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) throw new Error('Invalid webhook timestamp.');

  const tolerance = input.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    throw new Error('Webhook timestamp is outside the accepted tolerance.');
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${payload}`)
    .digest();
  const received = bytes(input.signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid webhook signature.');
  }

  return JSON.parse(payload) as WebhookEvent<TType, TData>;
}
