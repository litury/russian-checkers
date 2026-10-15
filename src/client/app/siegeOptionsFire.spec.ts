import { expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

it('keeps four named leaf actions and no visible side labels or slogan', () => {
 for (const [id, name] of [['play','С ботом'],['online','В сети'],['history','Профиль'],['options','Опции']])
  expect(html).toMatch(new RegExp(`id="opening-${id}"[^>]*>[\\s\\S]*?${name}`));
 expect(html).not.toContain('class="siege-side-label"');
 expect(html).not.toContain('class="opening-slogan"');
 expect(html).toContain("play.textContent = 'С ботом'");
 expect(html).not.toContain('play.innerHTML = activity');
 expect(html).not.toContain('id="opening-options-dialog"');
 expect(html).not.toContain('id="opening-sound"');
 expect(html).toContain("byId('opening-options').onclick = () => window.checkersSettings.open()");
 expect(html).toContain('aria-controls="opening-settings-dialog"');
 expect(html).toContain('id="settings-close" aria-label="Закрыть настройки"');
});

it('static art is immediately present without a decode barrier', () => {
 expect(html).not.toContain('opening-menu-readiness');
 expect(html).not.toContain('data-menu-state');
 expect(html).toContain('class="siege-cartouche atlas-slice"');
 expect(html).toContain('class="gate-piece atlas-slice"');
});

it('settings returns focus after close/Escape without reopening an intermediate panel', () => {
 class Node extends EventTarget {
  open = false; hidden = false; inert = false;
  onclick: ((event?: Event) => void) | null = null;
  focus = vi.fn();
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
 }
 const ids = ['opening','opening-options','opening-settings-dialog'];
 const nodes = Object.fromEntries(ids.map(id => [id,new Node()]));

 const script = html.match(/<script id="opening-options-navigation">([\s\S]*?)<\/script>/)![1];
 new Function('document',script)({getElementById:(id:string) => nodes[id]});
 const dialog = nodes['opening-settings-dialog'];
 dialog.showModal(); dialog.close();
 expect(nodes['opening-options'].focus).toHaveBeenCalledWith({preventScroll:true});
 expect(dialog.open).toBe(false);
 nodes['opening-options'].focus.mockClear();
 nodes.opening.inert = true; dialog.showModal(); dialog.close();
 expect(nodes['opening-options'].focus).not.toHaveBeenCalled();
});
