import type Phaser from 'phaser';
import { defeatTerminalLayout } from './defeatTerminalLayout';
import { createDefeatPress } from './defeatPress';

/** Native modal semantics; explicit release/cancel and keyboard-only focus. */
export function createDefeatControls(scene: Phaser.Scene, actions: [() => void, () => void], pressed: (index: number, down: boolean) => void) {
 let modal: HTMLDivElement | undefined;
 let buttons: HTMLButtonElement[] = [];
 let previous: HTMLElement | null = null;
 let keyboard = false;
 let pointer: number | null = null;
 let restoreInert: Array<[HTMLElement, boolean]> = [];
 const focusPaint = () => buttons.forEach(b => { b.dataset.keyboardFocus = String(keyboard && b === document.activeElement); });
 const press = createDefeatPress((i,down) => {
  pressed(i,down);
  if(buttons[i]) buttons[i].dataset.pressed=String(down);
 }, i => { hide(); actions[i](); });
 const cancel = () => { pointer=null; press.cancel(); };
 const onVisibility = () => { if(document.hidden) cancel(); };
 const hide = () => {
  cancel();
  if(typeof window !== 'undefined') { window.removeEventListener('blur',cancel); document.removeEventListener('visibilitychange',onVisibility); }
  modal?.remove(); modal=undefined; buttons=[];
  for (const [element,inert] of restoreInert) element.inert=inert;
  restoreInert=[];
  previous?.focus(); previous=null;
 };
 const layout = () => {
  if(!modal) return;
  const bounds=scene.game.canvas.getBoundingClientRect();
  const l=defeatTerminalLayout(scene.scale.width,scene.scale.height);
  const sx=bounds.width/scene.scale.width, sy=bounds.height/scene.scale.height;
  buttons.forEach((button,i) => {
   const b=l.buttons[i];
   Object.assign(button.style,{left:`${bounds.left+b.x*sx}px`,top:`${bounds.top+b.y*sy}px`,width:`${b.width*sx}px`,height:`${b.height*sy}px`});
  });
 };
 const show = () => {
  hide(); press.reset(); keyboard=false;
  if(typeof document === 'undefined') return;
  previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal=document.createElement('div'); modal.className='defeat-controls';
  modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label','Вы проиграли');
  Object.assign(modal.style,{position:'fixed',inset:'0',zIndex:'10000'});
  const style=document.createElement('style');
  style.textContent=`.defeat-controls button{position:fixed;background:transparent;color:transparent;border:0;padding:0;cursor:pointer;outline:none;touch-action:manipulation}
.defeat-controls button::after{content:'';position:absolute;inset:4px;pointer-events:none}
.defeat-controls button[data-keyboard-focus="true"]::after{background:linear-gradient(#A1B5A6,#A1B5A6) left top/10px 2px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) left top/2px 10px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) right top/10px 2px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) right top/2px 10px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) left bottom/10px 2px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) left bottom/2px 10px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) right bottom/10px 2px no-repeat,linear-gradient(#A1B5A6,#A1B5A6) right bottom/2px 10px no-repeat}
`;
  modal.append(style);
  for(const child of Array.from(document.body.children)) {
   if(child instanceof HTMLElement && child.tagName!=='SCRIPT') { restoreInert.push([child,child.inert]); child.inert=true; }
  }
  buttons=['Ещё раз','В меню'].map((label,i) => {
   const button=document.createElement('button'); button.type='button'; button.textContent=label;
   button.onfocus=focusPaint;
   button.onblur=() => { cancel(); focusPaint(); };
   button.onpointerdown=e => { if(!e.isPrimary || e.button!==0) return; keyboard=false; button.focus(); focusPaint(); pointer=e.pointerId; press.down(i); };
   button.onpointerleave=cancel;
   button.onpointercancel=cancel;
   button.onpointerup=e => {
    if(pointer!==e.pointerId) return;
    const b=button.getBoundingClientRect();
    pointer=null;
    if(e.clientX<b.left || e.clientX>b.right || e.clientY<b.top || e.clientY>b.bottom) { press.cancel(); return; }
    press.up(i);
   };
   // Pointer/keyboard activation is handled above/on keyup. Keep AT click activation.
   button.onclick=e => { e.preventDefault(); if(e.detail===0 && modal) { press.down(i); press.up(i); } };
   modal!.append(button); return button;
  });
  modal.addEventListener('pointerdown',() => { keyboard=false; focusPaint(); });
  modal.addEventListener('keydown',e => {
   e.stopPropagation(); keyboard=true; focusPaint();
   if(e.key==='Tab') { e.preventDefault(); cancel(); const i=buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i+(e.shiftKey ? -1 : 1)+2)%2].focus(); }
   if(e.key===' ' || e.key==='Enter') { e.preventDefault(); if(!e.repeat) press.down(buttons.indexOf(document.activeElement as HTMLButtonElement)); }
   if(e.key==='Escape') cancel();
  });
  modal.addEventListener('keyup',e => {
   e.stopPropagation();
   if(e.key===' ' || e.key==='Enter') { e.preventDefault(); press.up(buttons.indexOf(document.activeElement as HTMLButtonElement)); }
  });
  window.addEventListener('blur',cancel); document.addEventListener('visibilitychange',onVisibility);
  document.body.append(modal); layout(); buttons[0].focus();
 };
 scene.events?.once('shutdown',hide);
 return {show,hide,layout};
}
