import type Phaser from 'phaser';

declare global {
 interface Window {
  checkersStartup: { watchdog: number; fail: (message: string) => void; status: (message: string) => void };
 }
}

/** HTML already exists before this module or Phaser has downloaded. */
export function createOpeningOverlay(scene: Phaser.Scene, handlers: { onPlayBot: () => void }) {
 const root = document.getElementById('opening')!;
 const play = document.getElementById('opening-play') as HTMLButtonElement;
 const retry = document.getElementById('opening-retry')!;
 play.onclick = () => { if (!play.disabled && !root.hidden) handlers.onPlayBot(); };
 clearTimeout(window.checkersStartup.watchdog);
 play.disabled = false;
 play.textContent = 'Играть';
 play.removeAttribute('aria-label');
 play.setAttribute('aria-busy', 'false');
 play.hidden = false;
 retry.hidden = true;
 window.checkersStartup.status('Всё готово. Первый ход ваш.');
 scene.events.once('shutdown', () => {
  play.onclick = null;
 });
 let firstShow = true;
 return {
  layout: (_width: number, _height: number) => undefined,
  show: () => {
   root.hidden = false;
   document.getElementById('game')!.inert = true;
   if (!firstShow) play.focus({preventScroll:true});
   firstShow = false;
  },
  hide: () => {
   for (const id of ['opening-help-dialog', 'opening-settings-dialog']) {
    const dialog = document.getElementById(id) as HTMLDialogElement;
    if (dialog.open) dialog.close();
   }
   root.hidden = true;
   document.getElementById('game')!.inert = false;
   scene.game.canvas.focus({preventScroll:true});
  },
 };
}
