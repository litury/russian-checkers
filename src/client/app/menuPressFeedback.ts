import './menuPressFeedback.css';
import {emitMenuPressSound} from './menuPressSound';
import {mountHapticControls} from './haptics';

/** Native click owns selection. Touch contact only moves the renderer's disk. */
export function mountMenuPressFeedback(root:HTMLElement) {
 const cleanups:(()=>void)[]=[];
 cleanups.push(mountHapticControls(document));
 for(const button of root.querySelectorAll<HTMLButtonElement>('.gate-piece-slot')) {
  const layer=button.querySelector<HTMLElement>(':scope > .gate-piece-visual');
  layer?.classList.add('menu-press-visual');
  let pointer:number|null=null, suppressClick=false, generation=0;
  const available=()=>!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!root.hidden&&!root.inert&&!document.hidden;
  const inside=(e:PointerEvent)=>{const r=button.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;};
  const paint=(held:boolean)=>{
   layer?.classList.toggle('is-menu-pressed',held);
   root.dispatchEvent(new CustomEvent('menu-touch',{detail:{side:button.dataset.side,held}}));
  };
  const cancel=()=>{if(pointer!==null){pointer=null;generation++;suppressClick=true;paint(false);}};
  const listen=(target:EventTarget,type:string,fn:EventListener,capture=false)=>{
   target.addEventListener(type,fn,capture);cleanups.push(()=>target.removeEventListener(type,fn,capture));
  };
  listen(button,'pointerdown',((e:PointerEvent)=>{
   if(!available()||e.button!==0||!e.isPrimary||pointer!==null)return;
   suppressClick=false;
   if(e.pointerType!=='touch')return;
   pointer=e.pointerId;const token=++generation;paint(true);
   emitMenuPressSound(e,()=>token===generation&&pointer!==null&&available());
  }) as EventListener);
  listen(window,'pointerup',((e:PointerEvent)=>{
   if(e.pointerId!==pointer)return;
   if(!available()||!inside(e)){cancel();return;}
   pointer=null;generation++;paint(false);
  }) as EventListener);
  listen(window,'pointermove',((e:PointerEvent)=>{if(e.pointerId===pointer&&!inside(e))cancel();}) as EventListener);
  for(const type of ['pointercancel','lostpointercapture','pointerleave','blur'])listen(button,type,cancel);
  listen(window,'blur',cancel);
  listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen(button,'keydown',((e:KeyboardEvent)=>{
   if(![' ','Enter'].includes(e.key))return;
   if(e.repeat||!available()){e.preventDefault();return;}
   cancel();suppressClick=false;
  }) as EventListener);
  listen(button,'click',((e:MouseEvent)=>{
   if(suppressClick||!available()){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;return;}
  }) as EventListener,true);
  const observer=new MutationObserver(()=>{if(!available())cancel();});
  observer.observe(root,{attributes:true,attributeFilter:['hidden','inert']});
  observer.observe(button,{attributes:true,attributeFilter:['disabled','aria-disabled']});
  cleanups.push(()=>{observer.disconnect();cancel();layer?.classList.remove('menu-press-visual');});
 }
 return ()=>{for(const cleanup of cleanups)cleanup();};
}
const root=document.getElementById('opening');
if(root){const dispose=mountMenuPressFeedback(root);if(import.meta.hot)import.meta.hot.dispose(dispose);}
