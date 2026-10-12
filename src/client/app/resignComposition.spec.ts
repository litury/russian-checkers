import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/client/app/matchActions.css', 'utf8');

it('animates the assembled modal, not the background independently', () => {
 expect(css).toContain('#resign-confirmation[open]{animation:resign-material-enter');
 expect(css).toContain('#resign-confirmation[data-closing]{animation:resign-material-exit');
 expect(css).not.toContain('#resign-confirmation[open]::before{animation:');
 expect(css).not.toContain('#resign-confirmation[data-closing]::before{animation:');
 expect(css).toContain('#resign-confirmation[open],#resign-confirmation[open]::backdrop{animation:none}');
});
