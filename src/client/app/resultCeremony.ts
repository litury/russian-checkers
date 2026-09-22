import type Phaser from 'phaser';
import type { Side } from '@/rules';
import white from '../modules/board/selection-v2/frames/white/white-55.webp?url';
import black from '../modules/board/selection-v2/frames/black/black-55.webp?url';
import './resultCeremony.css';
const assets = import.meta.glob('./result-art/*.png', { eager:true, query:'?url', import:'default' }) as Record<string,string>;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ramp=(t:number,a:number,b:number)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
export function ceremonyPose(win:boolean,ms:number,reduced=false){
 const t=reduced?3200:Math.max(0,ms);
 return { descent:win?0:ramp(t,900,2100)*200, lift:win?ramp(t,600,2200)*48:0,
  doors:win?0:ramp(t,0,450)*(1-ramp(t,2500,3200)), grip:win?0:ramp(t,450,900),
  heat:win?0:(t>=2100&&t<2500?Math.sin((t-2100)/400*Math.PI):0),
  light:win?ramp(t,1400,2600):0, mantle:t<2500?0:t<2800?1:2, done:t>=3200 };
}
export function createResultOverlay(scene:Phaser.Scene,handlers:{onPlayAgain:()=>void;onMenu:()=>void;isOnline?:()=>boolean;onSound?:(win:boolean)=>void;onStopSound?:()=>void}){
 const root=document.createElement('div');root.className='result-ceremony';root.hidden=true;
 root.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="result-heading" tabindex="-1"><p class="result-eyebrow">РЕЗУЛЬТАТ ПАРТИИ</p><h1 id="result-heading"></h1><p class="result-scene-name"></p><canvas width="720" height="540" aria-hidden="true"></canvas><div class="result-actions"><button type="button" data-result="again">Ещё партия</button><button type="button" data-result="menu">В меню</button></div></section>';
 document.body.append(root);
 const panel=root.querySelector('section')!;const canvas=root.querySelector('canvas')!;const ctx=canvas.getContext('2d')!;
 const images:Record<string,HTMLImageElement>={};
 for(const [key,url] of [...Object.entries(assets).map(([k,v])=>[k.split('/').pop()!.replace('.png',''),v]),['white',white],['black',black]]){const im=new Image();im.src=url;images[key]=im;im.onload=()=>{if(!root.hidden)paint(last);};}
 let frame=0,start=0,last=0,won=false,draw=false,side:Side='white',shown=false,reduced=false,previous:HTMLElement|null=null;
 const inert=new Map<HTMLElement,boolean>();
 function sprite(name:string,x:number,y:number,w:number,h?:number){const im=images[name];if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x,y,w,h??w*im.naturalHeight/im.naturalWidth);}
 function paint(ms:number){
  const p=ceremonyPose(won,ms,reduced);root.dataset.elapsed=String(Math.round(ms));root.dataset.outcome=draw?'draw':won?'win':'loss';
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,270);
  const bg=ctx.createRadialGradient(180,128,8,180,140,210);bg.addColorStop(0,'#2a241c');bg.addColorStop(1,'#090b0d');ctx.fillStyle=bg;ctx.fillRect(0,0,360,270);
  const checkerW=188,checkerX=(360-checkerW)/2,vLeft=78/724*checkerW,vRight=646/724*checkerW,vBot=640/724*checkerW;
  const hatchW=328,hatchX=(360-hatchW)/2,rearY=128,lipY=150,clipY=176;
  const checkerY=(draw||won?22:-22)-(won?p.lift:0)+(won||draw?0:p.descent);
  if(won&&p.light){ctx.save();ctx.globalAlpha=p.light*.55;const beam=ctx.createLinearGradient(180,0,180,190);beam.addColorStop(0,'#ffecba');beam.addColorStop(1,'#ffecba00');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(152,0);ctx.lineTo(208,0);ctx.lineTo(270,180);ctx.lineTo(90,180);ctx.closePath();ctx.fill();ctx.restore();}
  if(!won&&!draw&&p.heat){ctx.fillStyle=`rgba(${Math.round(90+120*p.heat)},${Math.round(28+40*p.heat)},8,.75)`;ctx.beginPath();ctx.ellipse(180,rearY+36,54,16,0,0,Math.PI*2);ctx.fill();}
  sprite('rear',hatchX,rearY,hatchW);sprite('lip',hatchX,lipY,hatchW);
  if(!won&&!draw){ctx.fillStyle='#100e0c';ctx.beginPath();ctx.ellipse(180,lipY+18,58,18,0,0,Math.PI*2);ctx.fill();}
  if(won||draw){const pedW=214,pedH=pedW*305/515;sprite('pedestal',(360-pedW)/2,checkerY+vBot-54,pedW,pedH);}
  const piece=()=>{
   if(won){const mantleW=274,mantleH=mantleW*250/520,mx=checkerX+checkerW/2-mantleW/2,my=checkerY+(128/724)*checkerW-(28/250)*mantleH,strip=mantleW*.28;sprite('mantle-'+p.mantle,mx,my,mantleW,mantleH);sprite(side,checkerX,checkerY,checkerW,checkerW);ctx.save();ctx.beginPath();ctx.rect(mx,my,strip,mantleH);ctx.rect(mx+mantleW-strip,my,strip,mantleH);ctx.clip();sprite('mantle-'+p.mantle,mx,my,mantleW,mantleH);ctx.restore();}
   else sprite(side,checkerX,checkerY,checkerW,checkerW);
   if(!won&&!draw){const gripW=70,gripH=gripW*195/160,jawX=gripW*.58,jawY=gripH*.5,open=36*(1-p.grip),bite=28*p.grip,gy=checkerY+(520/724)*checkerW-jawY;sprite('grip-left',checkerX+vLeft-jawX+bite-open,gy,gripW,gripH);sprite('grip-right',checkerX+vRight-gripW*.34-bite+open,gy,gripW,gripH);}
  };
  if(won||draw)piece();
  else{ctx.save();ctx.beginPath();ctx.rect(0,0,360,clipY);ctx.clip();piece();ctx.restore();const doorW=136,doorH=50,meet=180,seal=54,travel=70*p.doors;sprite('door-left',meet-doorW+seal-travel,lipY+10,doorW,doorH);sprite('door-right',meet-seal+travel,lipY+10,doorW,doorH);}
 }
 function stop(){cancelAnimationFrame(frame);frame=0;handlers.onStopSound?.();}
 function hide(_force=false){stop();shown=false;root.hidden=true;inert.forEach((v,el)=>el.inert=v);inert.clear();if(previous?.isConnected)previous.focus({preventScroll:true});}
 // A final board pointerup cannot activate these controls: require a new down here.
 let armed:HTMLButtonElement|null=null;
 root.addEventListener('pointerdown',e=>{e.stopPropagation();armed=(e.target as HTMLElement).closest('button');});
 root.addEventListener('pointercancel',()=>{armed=null;});
 root.addEventListener('click',e=>{e.stopPropagation();const b=(e.target as HTMLElement).closest('button');if(!b)return;if((e as MouseEvent).detail!==0&&armed!==b)return;armed=null;hide();if(b.dataset.result==='again')handlers.onPlayAgain();else handlers.onMenu();});
 root.addEventListener('keydown',e=>{if(e.key==='Tab'){const bs=Array.from(root.querySelectorAll('button'));const i=bs.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus();}if(e.key==='Escape'){hide();handlers.onMenu();}});
 scene.events.once('shutdown',()=>{hide();root.remove();});
 return {layout:(_w:number,_h:number)=>{if(shown)paint(last);},hide,show:(winner:Side|'draw',human:Side)=>{
  if(shown)return;stop();shown=true;won=winner===human;draw=winner==='draw';side=human;last=0;armed=null;reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  root.querySelector('h1')!.textContent=draw?'НИЧЬЯ':won?'ПОБЕДА':'ПОРАЖЕНИЕ';root.querySelector('.result-scene-name')!.textContent=draw?'Равная борьба':won?'Возвышение':'Утилизация';root.querySelector('[data-result="again"]')!.textContent=handlers.isOnline?.()?'Сыграть с ботом':'Ещё партия';
  previous=document.activeElement as HTMLElement;for(const el of Array.from(document.body.children)){if(el!==root&&el instanceof HTMLElement){inert.set(el,el.inert);el.inert=true;}}
  root.hidden=false;panel.focus({preventScroll:true});paint(0);if(!reduced&&!draw)handlers.onSound?.(won);start=performance.now();
  const tick=(now:number)=>{if(!shown)return;last=Math.min(3200,now-start);paint(last);if(last<3200)frame=requestAnimationFrame(tick);};if(!reduced&&!draw)frame=requestAnimationFrame(tick);
 }};
}
