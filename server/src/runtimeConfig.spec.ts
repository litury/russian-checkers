import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../vite.config';

const root = new URL('../../', import.meta.url);

describe('API runtime packaging', () => {
  it('resolves shared rules without the client Vite configuration', () => {
    expect(config).toMatchObject({
      resolve: { alias: { '@': fileURLToPath(new URL('src', root)) } },
    });
    expect(config).not.toHaveProperty('server');
  });

  it('ships and selects the API configuration for the default Docker command', () => {
    const dockerfile = readFileSync(new URL('Dockerfile.api', root), 'utf8');
    expect(dockerfile).toContain('COPY server ./server');
    const cmd = dockerfile.split('\n').find((line) => line.startsWith('CMD '));
    expect(JSON.parse(cmd!.slice(4))).toEqual([
      './node_modules/.bin/vite-node', '--config', 'server/vite.config.ts', 'server/src/index.ts',
    ]);
  });

  it('uses the same configuration for local API entrypoints', () => {
    const pkg = JSON.parse(readFileSync(new URL('server/package.json', root), 'utf8'));
    for (const name of ['start', 'dev', 'seed']) {
      expect(pkg.scripts[name]).toContain('vite-node --config server/vite.config.ts');
    }
  });
});
