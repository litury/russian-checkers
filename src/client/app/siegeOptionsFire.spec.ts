import { expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

it('keeps four named leaf actions and no visible side labels or slogan', () => {
 for (const [id, name] of [['play','С машиной'],['online','С человеком'],['history','Партии'],['options','Опции']])
  expect(html).toMatch(new RegExp(`id="opening-${id}"[^>]*>[\\s\\S]*?${name}`));
 expect(html).not.toContain('class="siege-side-label"');
 expect(html).not.toContain('class="opening-slogan"');
 expect(html).toContain("play.textContent = 'С машиной'");
 expect(html).not.toContain('play.innerHTML = activity');
 for (const id of ['help','settings']) {
  expect(html.match(new RegExp(`id="opening-${id}"`, 'g'))).toHaveLength(1);
  expect(html).toMatch(new RegExp(`<dialog id="opening-options-dialog"[\\s\\S]*?id="opening-${id}"[\\s\\S]*?</dialog>`));
 }
});

it('marks decoded required leaves ready before unrelated art resolves (early-click race)', async () => {
 const start = html.indexOf(' const art = document.querySelector');
 const end = html.indexOf(" for (const name of ['help', 'settings'])", start);
 expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
 const pending: (() => void)[] = [];
 const images = Array.from({length:4}, () => ({complete:true,naturalWidth:1536,classList:{add:vi.fn(),remove:vi.fn()},addEventListener:vi.fn(),removeEventListener:vi.fn(),decode:() => new Promise<void>(resolve => pending.push(resolve))}));
 const art = {querySelectorAll:() => images.slice(0,3),classList:{add:vi.fn()}};
 const timers: unknown[] = [];
 new Function('document','setTimeout','clearTimeout',html.slice(start,end))({querySelector:(s:string) => s === '.opening-art' ? art : images[3]},(fn:unknown) => {timers.push(fn); return timers.length;},vi.fn());
 pending[0](); pending[1]();
 for(let i=0;i<10;i++) await Promise.resolve();
 expect(images[0].classList.add).toHaveBeenCalledWith('is-decoded');
 expect(images[1].classList.add).toHaveBeenCalledWith('is-decoded');
 expect(images[3].classList.add).not.toHaveBeenCalled();
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
