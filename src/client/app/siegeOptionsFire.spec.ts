import { expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

it('keeps four named leaf actions and no visible side labels or slogan', () => {
 for (const [id, name] of [['play','С ботом'],['online','В сети'],['history','Партии'],['options','Опции']])
  expect(html).toMatch(new RegExp(`id="opening-${id}"[^>]*>[\\s\\S]*?${name}`));
 expect(html).not.toContain('class="siege-side-label"');
 expect(html).not.toContain('class="opening-slogan"');
 expect(html).toContain("play.textContent = 'С ботом'");
 expect(html).not.toContain('play.innerHTML = activity');
 for (const id of ['help','settings']) {
  expect(html.match(new RegExp(`id="opening-${id}"`, 'g'))).toHaveLength(1);
  expect(html).toMatch(new RegExp(`<dialog id="opening-options-dialog"[\\s\\S]*?id="opening-${id}"[\\s\\S]*?</dialog>`));
 }
});

it('initial reveal includes decoded leaves, not independent early CTA (new menu contract)', () => {
 // Async state/decode/error/cleanup are exercised by menuReadiness.spec.ts.
 const script = html.match(/<script id="opening-menu-readiness">([\s\S]*?)<\/script>/)![1];
 expect(script).toContain("root.querySelectorAll('.siege-housing img,.gate-piece')");
 expect(script).toContain("images.forEach(image => image.classList.add('is-decoded'))");
 expect(script.indexOf("images.forEach")).toBeLessThan(script.indexOf('root.dataset.menuState = state'));
 expect(html).toContain(':not(.menu-loading):not(noscript) *{visibility:hidden!important}');
});

it('options reuses existing handlers and returns focus after child close/Escape and menu close', () => {
 class Node extends EventTarget {
  open = false; hidden = false; inert = false;
  onclick: ((event?: Event) => void) | null = null;
  focus = vi.fn();
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
 }
 const ids = ['opening','opening-options','opening-options-dialog','opening-help','opening-settings','opening-help-dialog','opening-settings-dialog'];
 const nodes = Object.fromEntries(ids.map(id => [id,new Node()]));
 const help = vi.fn(() => nodes['opening-help-dialog'].showModal());
 const settings = vi.fn(() => nodes['opening-settings-dialog'].showModal());
 nodes['opening-help'].onclick = help; nodes['opening-settings'].onclick = settings;
 const script = html.match(/<script id="opening-options-navigation">([\s\S]*?)<\/script>/)![1];
 new Function('document',script)({getElementById:(id:string) => nodes[id]});
 const options = nodes['opening-options-dialog'];
 nodes['opening-options'].onclick!(); expect(options.open).toBe(true);
 for (const name of ['help','settings']) {
  nodes['opening-'+name].onclick!();
  expect(options.open).toBe(false);
  const child = nodes['opening-'+name+'-dialog']; expect(child.open).toBe(true);
  // Native Escape and method=dialog both dispatch close.
  child.close(); expect(options.open).toBe(true);
  expect(nodes['opening-'+name].focus).toHaveBeenCalledWith({preventScroll:true});
 }
 expect(help).toHaveBeenCalledTimes(1); expect(settings).toHaveBeenCalledTimes(1);
 options.close(); expect(nodes['opening-options'].focus).toHaveBeenCalledWith({preventScroll:true});
 nodes['opening-options'].onclick!(); nodes['opening-help'].onclick!();
 nodes.opening.inert = true; nodes['opening-help-dialog'].close();
 expect(options.open).toBe(false);
});
