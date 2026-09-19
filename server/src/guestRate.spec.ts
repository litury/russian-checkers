import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('guest IP cap covers 6–8 tabs, not thousands', () => {
 const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
 expect(src).toMatch(/limited\(`g:\$\{ipOf\(req\)\}`, 24\)/);
 expect(src).not.toMatch(/limited\(`g:\$\{ipOf\(req\)\}`, 8\)/);
 expect(src).not.toMatch(/limited\(`g:\$\{ipOf\(req\)\}`, 1000\)/);
});
