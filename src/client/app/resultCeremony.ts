import type Phaser from 'phaser';
import type { Side } from '@/rules';
import white from '../modules/board/selection-v2/frames/white/white-55.webp?url';
import black from '../modules/board/selection-v2/frames/black/black-55.webp?url';
import rearUrl from './result-art/rear.png?url';
import lipUrl from './result-art/lip.png?url';
import gripLeftUrl from './result-art/grip-left.png?url';
import gripRightUrl from './result-art/grip-right.png?url';
import pedestalUrl from './result-art/pedestal.png?url';
import mantle0 from './result-art/mantle-0.png?url';
import mantle1 from './result-art/mantle-1.png?url';
import mantle2 from './result-art/mantle-2.png?url';
import lidUrl from './result-art/lid.png?url';
import './resultCeremony.css';
const assets: Record<string, string> = {
 rear: rearUrl, lip: lipUrl, 'grip-left': gripLeftUrl, 'grip-right': gripRightUrl, pedestal: pedestalUrl,
 'mantle-0': mantle0, 'mantle-1': mantle1, 'mantle-2': mantle2, lid: lidUrl,
};
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
 const ready=Promise.all([...Object.entries(assets),['white',white],['black',black]].map(async ([key,url])=>{const im=new Image();images[key]=im;im.src=url;try{await im.decode();return true;}catch{return false;}}));
 let generation=0;
 let frame=0,start=0,last=0,won=false,draw=false,side:Side='white',shown=false,reduced=false,previous:HTMLElement|null=null;
 const inert=new Map<HTMLElement,boolean>();
 function sprite(name:string,x:number,y:number,w:number,h?:number){const im=images[name];if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x,y,w,h??w*im.naturalHeight/im.naturalWidth);}
 function drawMantle(x:number,y:number,w:number,ms:number,front=false){
  const sample=images['mantle-0']; if(!sample?.naturalWidth)return;
  const h=w*sample.naturalHeight/sample.naturalWidth, t=reduced?2:ramp(ms,1400,3100)*2, i=t>=2?1:Math.floor(t), f=t>=2?1:t-i;
  ctx.save();
  if(front){ctx.beginPath();ctx.ellipse(x+w/2,y+h*0.62,w*0.46,h*0.5,0,0,Math.PI*2);ctx.clip();}
  ctx.globalAlpha=1-f;sprite('mantle-'+i,x,y,w,h);
  ctx.globalAlpha=f;sprite('mantle-'+(i+1),x,y,w,h);
  if(!front){ctx.globalCompositeOperation='destination-in';
  const fade=ctx.createLinearGradient(0,y,0,y+h*0.48);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(0.55,'rgba(0,0,0,.35)');fade.addColorStop(1,'#000');
  ctx.fillStyle=fade;ctx.fillRect(x,y,w,h*0.48);ctx.fillStyle='#000';ctx.fillRect(x,y+h*0.48,w,h*0.52);}
  ctx.restore();
 }
 function drawLid(x:number,y:number,w:number,open:number){
  const im=images.lid;if(!im?.complete||!im.naturalWidth)return;
  const h=w*im.naturalHeight/im.naturalWidth;
  if(open<0.02){ctx.drawImage(im,x,y,w,h);return;}
  const seam=im.naturalWidth/2, travel=open*128, hw=w/2;
  ctx.drawImage(im,0,0,seam,im.naturalHeight,x-travel,y,hw,h);
  ctx.drawImage(im,seam,0,im.naturalWidth-seam,im.naturalHeight,x+hw+travel,y,hw,h);
 }
 function paint(ms:number){
  const p=ceremonyPose(won,ms,reduced);root.dataset.elapsed=String(Math.round(ms));root.dataset.outcome=draw?'draw':won?'win':'loss';
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,270);
  const bg=ctx.createRadialGradient(180,128,8,180,140,210);bg.addColorStop(0,'#2a241c');bg.addColorStop(1,'#090b0d');ctx.fillStyle=bg;ctx.fillRect(0,0,360,270);
  const checkerW=156,checkerX=(360-checkerW)/2,vLeft=78/724*checkerW,vRight=646/724*checkerW;
  const hatchW=300,hatchX=(360-hatchW)/2,rearY=118,lipY=146;
  const checkerY=(won?50:draw?24:-16)-(won?p.lift:0)+(won||draw?0:p.descent);
  if(won&&p.light){ctx.save();ctx.globalAlpha=p.light*.5;const beam=ctx.createLinearGradient(180,0,180,170);beam.addColorStop(0,'#ffecba');beam.addColorStop(1,'#ffecba00');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(158,0);ctx.lineTo(202,0);ctx.lineTo(248,168);ctx.lineTo(112,168);ctx.closePath();ctx.fill();ctx.restore();}
  if(!won&&!draw&&p.heat){ctx.fillStyle=`rgba(${Math.round(90+120*p.heat)},${Math.round(28+40*p.heat)},8,.75)`;ctx.beginPath();ctx.ellipse(180,rearY+34,50,14,0,0,Math.PI*2);ctx.fill();}
  if(!won&&!draw){sprite('rear',hatchX,rearY,hatchW);ctx.fillStyle='#100e0c';ctx.beginPath();ctx.ellipse(180,lipY+16,52,15,0,0,Math.PI*2);ctx.fill();}
  const piece=()=>{
   if(won){const mantleW=312,lag=reduced?0:(1-ramp(ms,1600,2800))*8,mx=checkerX+checkerW/2-mantleW/2,my=checkerY+checkerW*0.42+lag;drawMantle(mx,my,mantleW,ms);sprite(side,checkerX,checkerY,checkerW,checkerW);drawMantle(mx,my,mantleW,ms,true);}
   else sprite(side,checkerX,checkerY,checkerW,checkerW);
   if(!won&&!draw){const gripW=64,gripH=gripW*195/160,jawX=gripW*.58,jawY=gripH*.5,open=32*(1-p.grip),bite=24*p.grip,gy=checkerY+(520/724)*checkerW-jawY;sprite('grip-left',checkerX+vLeft-jawX+bite-open,gy,gripW,gripH);sprite('grip-right',checkerX+vRight-gripW*.34-bite+open,gy,gripW,gripH);}
  };
  if(won||draw){const pedW=168,pedH=pedW*305/515;sprite('pedestal',(360-pedW)/2,checkerY+checkerW*0.72,pedW,pedH);piece();}
  else{
   ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(360,0);ctx.lineTo(360,lipY+8);ctx.lineTo(292,lipY+8);ctx.quadraticCurveTo(180,lipY+86,68,lipY+8);ctx.lineTo(0,lipY+8);ctx.closePath();ctx.clip();piece();ctx.restore();
   if(p.doors<0.02){drawLid(180-124,lipY-28,248,0);sprite('lip',hatchX,lipY,hatchW);}
   else{sprite('lip',hatchX,lipY,hatchW);drawLid(180-124,lipY-28,248,p.doors);}
  }
 }
 function stop(){cancelAnimationFrame(frame);frame=0;handlers.onStopSound?.();}
 function hide(_force=false){generation++;stop();shown=false;root.hidden=true;inert.forEach((v,el)=>el.inert=v);inert.clear();if(previous?.isConnected)previous.focus({preventScroll:true});}
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
  root.hidden=false;panel.focus({preventScroll:true});canvas.style.visibility='hidden';root.dataset.art='loading';const token=++generation;
  void ready.then(loaded=>{
   if(!shown||token!==generation)return;
   root.dataset.art=loaded.every(Boolean)?'ready':'unavailable';
   if(!loaded.every(Boolean))return;
   canvas.style.visibility='visible';paint(0);if(!reduced&&!draw)handlers.onSound?.(won);start=performance.now();
   const tick=(now:number)=>{if(!shown||token!==generation)return;last=Math.min(3200,now-start);paint(last);if(last<3200)frame=requestAnimationFrame(tick);};if(!reduced&&!draw)frame=requestAnimationFrame(tick);
  });
 }};
}
