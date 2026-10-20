import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyWebhook } from '../src/index.js';

describe('verifyWebhook', () => {
  it('validates and parses a signed payload', () => {
    const payload = JSON.stringify({ type: 'charge.paid', data: { externalId: 'order_1' } });
    const timestamp = '1792512000';
    const signature = createHmac('sha256', 'secret').update(`${timestamp}.${payload}`).digest('hex');

    const event = verifyWebhook({
      payload,
      timestamp,
      signature,
      secret: 'secret',
      now: new Date(Number(timestamp) * 1000),
    });

    expect(event.type).toBe('charge.paid');
  });

  it('rejects invalid signatures', () => {
    expect(() =>
      verifyWebhook({
        payload: '{}',
        timestamp: '1792512000',
        signature: '0'.repeat(64),
        secret: 'secret',
        now: new Date(1792512000 * 1000),
      }),
    ).toThrow('Invalid webhook signature.');
  });
});
