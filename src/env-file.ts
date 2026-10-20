import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readEnvFile(path = '.env'): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

export function writeEnvValues(values: Record<string, string>, path = '.env'): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const keys = new Set(Object.keys(values));
  const lines = existing.split(/\r?\n/).filter((line) => {
    const separator = line.indexOf('=');
    return separator < 0 || !keys.has(line.slice(0, separator).trim());
  });
  while (lines.length && !lines.at(-1)) lines.pop();
  lines.push(...Object.entries(values).map(([key, value]) => `${key}=${value}`), '');
  writeFileSync(path, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });

  const ignorePath = join(dirname(path), '.gitignore');
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  if (!ignore.split(/\r?\n/).some((line) => line.trim() === '.env')) {
    writeFileSync(ignorePath, `${ignore.trimEnd()}${ignore ? '\n' : ''}.env\n`, 'utf8');
  }
}

export function writeApiKey(apiKey: string, path = '.env'): void {
  writeEnvValues(
    { BARZANO_PAY_API_KEY: apiKey, BARZANO_PAY_ENVIRONMENT: 'sandbox' },
    path,
  );
}
