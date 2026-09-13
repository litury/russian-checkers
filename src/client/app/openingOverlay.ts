import type Phaser from 'phaser';
import { getSfxMaster, getSfxMuted, setSfxMaster, setSfxMuted } from '@/client/modules/sfx/createTableSfx';

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
 const volume = document.getElementById('opening-volume') as HTMLInputElement;
 const muted = document.getElementById('opening-muted') as HTMLInputElement;
 const settings = document.getElementById('opening-settings')!;
 const syncSound = () => { volume.value = String(Math.round(getSfxMaster() * 100)); muted.checked = getSfxMuted(); };
 volume.oninput = () => { setSfxMaster(Number(volume.value) / 100); syncSound(); };
 muted.onchange = () => { setSfxMuted(muted.checked); syncSound(); };
 settings.addEventListener('click', syncSound);
 play.onclick = () => { if (!play.disabled && !root.hidden) handlers.onPlayBot(); };
 clearTimeout(window.checkersStartup.watchdog);
 play.disabled = false;
 play.hidden = false;
 retry.hidden = true;
 window.checkersStartup.status('Всё готово. Ваш ход — первый.');
 syncSound();
 scene.events.once('shutdown', () => {
  play.onclick = null; volume.oninput = null; muted.onchange = null;
  settings.removeEventListener('click', syncSound);
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
