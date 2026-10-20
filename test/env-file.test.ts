import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readEnvFile, writeApiKey, writeEnvValues } from '../src/env-file.js';

describe('environment file', () => {
  it('persists the integration key without duplicating previous Barzano values', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'barzano-sdk-')), '.env');

    writeApiKey('pay_test_first', path);
    writeApiKey('pay_test_second', path);

    expect(readEnvFile(path)).toMatchObject({
      BARZANO_PAY_API_KEY: 'pay_test_second',
      BARZANO_PAY_ENVIRONMENT: 'sandbox',
    });
    expect(readFileSync(path, 'utf8').match(/BARZANO_PAY_API_KEY/g)).toHaveLength(1);
    expect(readFileSync(join(path, '..', '.gitignore'), 'utf8')).toContain('.env');

    writeEnvValues({ BARZANO_STORE_ID: 'store_123' }, path);
    expect(readEnvFile(path).BARZANO_STORE_ID).toBe('store_123');
    expect(readEnvFile(path).BARZANO_PAY_API_KEY).toBe('pay_test_second');
  });
});
