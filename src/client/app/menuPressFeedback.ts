import './menuPressFeedback.css';
import {MenuPressState} from './menuPressFeedbackState';
import {emitMenuPressSound} from './menuPressSound';

/** Independent visual wrapper: never transform the button, label or selection canvas itself. */
export function mountMenuPressFeedback(root:HTMLElement) {
 const cleanups:(()=>void)[]=[];
 for(const button of root.querySelectorAll<HTMLButtonElement>('.gate-piece-slot')) {
  let visual=button.querySelector<HTMLElement>(':scope > .menu-press-visual,:scope > .gate-piece-visual');
  const created=!visual;
  const hadPressClass=visual?.classList.contains('menu-press-visual');
  if(!visual) {
   visual=document.createElement('span');visual.className='menu-press-visual';visual.setAttribute('aria-hidden','true');
   for(const node of button.querySelectorAll(':scope > img.gate-piece,:scope > canvas'))visual.append(node);
   button.prepend(visual);
  }
  const layer=visual;
  layer.classList.add('menu-press-visual');
  let event:Event, generation=0, suppressClick=false;
  const available=()=>!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!root.hidden&&!root.inert&&!document.hidden;
  const state=new MenuPressState(active=>{
   generation++;layer.classList.toggle('is-menu-pressed',active);
  },()=>{
   const token=generation;
   emitMenuPressSound(event,()=>token===generation&&state.active&&available());
  });
  const cancel=()=>{if(state.active)suppressClick=true;state.cancel();};
  const listen=(target:EventTarget,type:string,fn:EventListener,capture=false)=>{
   target.addEventListener(type,fn,capture);cleanups.push(()=>target.removeEventListener(type,fn,capture));
  };
  listen(button,'pointerdown',((e:PointerEvent)=>{
   if(!available()||e.button!==0||!e.isPrimary)return;
   suppressClick=false;event=e;state.down(`pointer:${e.pointerId}`);
  }) as EventListener);
  listen(window,'pointerup',((e:PointerEvent)=>state.up(`pointer:${e.pointerId}`)) as EventListener);
  listen(button,'pointermove',((e:PointerEvent)=>{
   const r=button.getBoundingClientRect();
   if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancel();
  }) as EventListener);
  for(const type of ['pointercancel','lostpointercapture','pointerleave','blur'])listen(button,type,cancel);
  listen(window,'blur',cancel);
  listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen(button,'keydown',((e:KeyboardEvent)=>{
   if(![' ','Enter'].includes(e.key))return;
   if(e.repeat||!available()){e.preventDefault();return;}
   suppressClick=false;event=e;state.down(`key:${e.key}`);
  }) as EventListener);
  listen(button,'keyup',((e:KeyboardEvent)=>{
   if(![' ','Enter'].includes(e.key))return;
   if(suppressClick||!available())e.preventDefault();
   state.up(`key:${e.key}`);
  }) as EventListener);
  // Do not synthesize selection. Suppress only cancelled or unavailable activations.
  listen(button,'click',((e:MouseEvent)=>{
   if(suppressClick||!available()){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}
  }) as EventListener,true);
  const observer=new MutationObserver(()=>{if(!available())cancel();});
  observer.observe(root,{attributes:true,attributeFilter:['hidden','inert']});
  observer.observe(button,{attributes:true,attributeFilter:['disabled','aria-disabled']});
  cleanups.push(()=>{observer.disconnect();state.cancel();if(created){layer.replaceWith(...layer.childNodes);}else if(!hadPressClass)layer.classList.remove('menu-press-visual');});
 }
 return ()=>{for(const cleanup of cleanups)cleanup();};
}
const root=document.getElementById('opening');
if(root){const dispose=mountMenuPressFeedback(root);if(import.meta.hot)import.meta.hot.dispose(dispose);}
