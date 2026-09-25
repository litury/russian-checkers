import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ceremony = readFileSync(new URL('./resultCeremony.ts', import.meta.url), 'utf8');
const ceremonyCss = readFileSync(new URL('./resultCeremony.css', import.meta.url), 'utf8');
const defeatControls = readFileSync(new URL('./defeatControls.ts', import.meta.url), 'utf8');
const history = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

describe('defeat title and button plaques', () => {
  it('reuses the menu cassette frame and does not bake a new alphabet', () => {
    expect(ceremony).toContain("ui/siege/cassette-title.webp");
    expect(ceremony).toContain('result-title-plate');
    expect(ceremony).toContain('Ещё партия');
    expect(ceremony).toContain('В меню');
    expect(ceremony).not.toContain('defeat-button-label');
    expect(history).toContain('cassette-title.webp');
    expect(history).toContain('mh-title-plate');
  });

  it('keeps button plaques unstretched and does not mask the layout', () => {
    expect(ceremonyCss).toContain('object-fit:contain');
    expect(ceremonyCss).toContain('center/contain');
    expect(ceremonyCss).not.toContain('100% 100%');
    expect(ceremonyCss).not.toContain('overflow:hidden');
    expect(ceremonyCss).toContain('defeat-button-rest.webp');
    expect(ceremonyCss).toContain('defeat-button-pressed.webp');
  });

  it('leaves the terminal hitbox pair transparent', () => {
    expect(defeatControls).toContain("buttons=['Ещё раз','В меню']");
    expect(defeatControls).toContain('background:transparent');
    expect(defeatControls).not.toContain('defeat-button-rest');
    expect(defeatControls).not.toContain('cassette-title');
  });
});
