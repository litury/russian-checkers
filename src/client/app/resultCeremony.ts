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
import fireUrl from './ui/siege/menu-selection-fire.webp?url';
import terminalUrl from './ui/result/terminal_sockets.webp?url';
import contactUrl from './ui/bunker/lip-contact-shadow.webp?url';
import titlePlateUrl from './ui/result/defeat-title-frame.webp?url';
import './resultCeremony.css';
const assets: Record<string, string> = {
 rear: rearUrl, lip: lipUrl, 'grip-left': gripLeftUrl, 'grip-right': gripRightUrl, pedestal: pedestalUrl,
 'mantle-0': mantle0, 'mantle-1': mantle1, 'mantle-2': mantle2, lid: lidUrl,
 fire: fireUrl, terminal: terminalUrl, contact: contactUrl,
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
const checkerW=156, checkerY0=-16, opaqueFrac=0.939, mouthY=162;
export function lossLayout(ms:number,reduced=false){
 const pose=ceremonyPose(false,ms,reduced);
 const sink=pose.descent/200;
 const squash=Math.min(1,pose.grip*0.78+sink*0.9);
 const scaleX=1+0.4*squash, scaleY=1-0.58*squash;
 const checkerY=checkerY0+pose.descent;
 const pieceBottom=checkerY+opaqueFrac*checkerW;
 return {...pose,squash,scaleX,scaleY,checkerY,pieceBottom,shadowY:pieceBottom+10,mouthY,fire:pose.heat>0.04};
}
export function createResultOverlay(scene:Phaser.Scene,handlers:{onPlayAgain:()=>void;onMenu:()=>void;isOnline?:()=>boolean;onSound?:(win:boolean)=>void;onStopSound?:()=>void}){
 const root=document.createElement('div');root.className='result-ceremony';root.hidden=true;
 root.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="result-heading" tabindex="-1"><div class="result-title-plate"><img class="result-title-frame" src="'+titlePlateUrl+'" width="1909" height="636" alt="" /><div class="result-title-copy"><p class="result-eyebrow">РЕЗУЛЬТАТ ПАРТИИ</p><h1 id="result-heading"></h1><p class="result-scene-name"></p></div></div><canvas width="720" height="540" aria-hidden="true"></canvas><div class="result-actions"><button type="button" data-result="again">Ещё партия</button><button type="button" data-result="menu">В меню</button></div></section>';
 document.body.append(root);
 const panel=root.querySelector('section')!;const canvas=root.querySelector('canvas')!;const ctx=canvas.getContext('2d')!;
 const images:Record<string,HTMLImageElement>={};
 const ready=Promise.all([...Object.entries(assets),['white',white],['black',black]].map(async ([key,url])=>{const im=new Image();images[key]=im;im.src=url;try{await im.decode();return true;}catch{return false;}}));
 let generation=0;
 let frame=0,start=0,last=0,won=false,draw=false,side:Side='white',shown=false,reduced=false,previous:HTMLElement|null=null;
 const inert=new Map<HTMLElement,boolean>();
 function sprite(name:string,x:number,y:number,w:number,h?:number){const im=images[name];if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x,y,w,h??w*im.naturalHeight/im.naturalWidth);}
 const bottoms:Record<string,number>={};
 function pieceBottomFrac(name:string){
  if(bottoms[name])return bottoms[name];
  const im=images[name]; if(!im?.naturalWidth)return opaqueFrac;
  try{
   const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
   const g=c.getContext('2d'); if(!g)return opaqueFrac;
   g.drawImage(im,0,0);
   const data=g.getImageData(0,0,c.width,c.height).data;
   let maxY=0,n=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>24){maxY=y;n++;}
   bottoms[name]=n?maxY/(c.height-1):opaqueFrac;
  }catch{bottoms[name]=opaqueFrac;}
  return bottoms[name];
 }
 const faces:Record<string,number>={};
 function faceFrac(name:string){
  if(faces[name])return faces[name];
  const im=images[name]; if(!im?.naturalWidth)return 0.78;
  try{
   const x=Math.max(0,Math.floor(im.naturalWidth/2)-2);
   const c=document.createElement('canvas');c.width=4;c.height=im.naturalHeight;
   const g=c.getContext('2d'); if(!g)return 0.78;
   g.drawImage(im,x,0,4,im.naturalHeight,0,0,4,c.height);
   const d=g.getImageData(0,0,4,c.height).data;
   let last=Math.floor(0.78*(c.height-1));
   for(let y=0;y<c.height;y++)for(let col=0;col<4;col++){
    const i=(y*4+col)*4; if(d[i+3]>32&&d[i]>145&&d[i+1]>125)last=y;
   }
   faces[name]=last/(c.height-1);
  }catch{faces[name]=0.78;}
  return faces[name];
 }
 let contactPlate:HTMLCanvasElement|null=null;
 function plate(){
  if(contactPlate)return contactPlate;
  const im=images.contact; if(!im?.naturalWidth)return null;
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const g=c.getContext('2d'); if(!g)return null;
  g.drawImage(im,0,0);
  const img=g.getImageData(0,0,c.width,c.height); const d=img.data;
  for(let i=0;i<d.length;i+=4){const a=d[i+3];d[i]=6;d[i+1]=5;d[i+2]=4;d[i+3]=a<6?0:Math.min(225,a*3);}
  g.putImageData(img,0,0);
  contactPlate=c; return c;
 }
 function drawContactShadow(anchorX:number,visualBottom:number,scaleX:number){
  const im=plate(); if(!im)return false;
  const w=Math.min(172,148*Math.min(scaleX,1.15)), h=12, cx=anchorX+2, cy=visualBottom+3;
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha=0.75;ctx.fillStyle='#100c0a';ctx.fillRect(cx-w/2,cy-h/2,w,h);
  ctx.globalAlpha=1;ctx.drawImage(im,cx-w/2,cy-h/2,w,h);
  ctx.restore();
  return true;
 }
 function drawFire(ms:number,heat:number){
  const im=images.fire; if(!im?.naturalWidth||heat<=0.04)return;
  const frame=Math.floor(ms/80)%8, col=frame%4, row=Math.floor(frame/4), cell=256;
  const w=158,h=158,px=128/256*w,py=200/256*h;
  ctx.save();
  ctx.beginPath();ctx.ellipse(180,mouthY-6,64,52,0,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha=0.55+0.45*heat;
  ctx.drawImage(im,col*cell,row*cell,cell,cell,180-px,mouthY-py+4,w,h);
  const f2=(frame+3)%8;
  ctx.globalAlpha=0.4+0.45*heat;
  ctx.drawImage(im,(f2%4)*cell,Math.floor(f2/4)*cell,cell,cell,180-px-8,mouthY-py-10,w*0.86,h*0.86);
  ctx.restore();
 }
 function paint(ms:number){
  const p=ceremonyPose(won,ms,reduced);root.dataset.elapsed=String(Math.round(ms));root.dataset.outcome=draw?'draw':won?'win':'loss';
  const loss=!won&&!draw?lossLayout(ms,reduced):null;
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,270);
  const bg=ctx.createRadialGradient(180,128,8,180,140,210);bg.addColorStop(0,'#2a241c');bg.addColorStop(1,'#090b0d');ctx.fillStyle=bg;ctx.fillRect(0,0,360,270);
  const checkerX=(360-checkerW)/2,vLeft=78/724*checkerW,vRight=646/724*checkerW;
  const hatchW=300,hatchX=(360-hatchW)/2,rearY=118,lipY=146;
  const checkerY=(won?50:draw?24:checkerY0)-(won?p.lift:0)+(won||draw?0:p.descent);
  if(won&&p.light){ctx.save();ctx.globalAlpha=p.light*.5;const beam=ctx.createLinearGradient(180,0,180,170);beam.addColorStop(0,'#ffecba');beam.addColorStop(1,'#ffecba00');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(158,0);ctx.lineTo(202,0);ctx.lineTo(248,168);ctx.lineTo(112,168);ctx.closePath();ctx.fill();ctx.restore();}
  if(loss){const tw=132,th=tw*432/324;sprite('terminal',(360-tw)/2,4,tw,th);root.dataset.terminal=images.terminal?.naturalWidth?'1':'0';}
  else delete root.dataset.terminal;
  if(loss){sprite('rear',hatchX,rearY,hatchW);ctx.fillStyle='#100e0c';ctx.beginPath();ctx.ellipse(180,mouthY,52,15,0,0,Math.PI*2);ctx.fill();}
  const piece=()=>{
   if(won){const mantleW=312,lag=reduced?0:(1-ramp(ms,1600,2800))*8,mx=checkerX+checkerW/2-mantleW/2,my=checkerY+checkerW*0.42+lag;drawMantle(mx,my,mantleW,ms);sprite(side,checkerX,checkerY,checkerW,checkerW);drawMantle(mx,my,mantleW,ms,true);}
   else if(loss){
    const frac=pieceBottomFrac(side);
    const anchorX=checkerX+checkerW/2, anchorY=checkerY+frac*checkerW;
    ctx.save();ctx.translate(anchorX,anchorY);ctx.scale(loss.scaleX,loss.scaleY);ctx.translate(-anchorX,-anchorY);sprite(side,checkerX,checkerY,checkerW,checkerW);ctx.restore();
    const gripW=64,gripH=gripW*195/160,jawX=gripW*.58,jawY=gripH*.5,open=32*(1-loss.grip),bite=24*loss.grip,gy=anchorY-jawY*loss.scaleY;
    sprite('grip-left',checkerX+vLeft-jawX+bite-open,gy,gripW,gripH);sprite('grip-right',checkerX+vRight-gripW*.34-bite+open,gy,gripW,gripH);
    root.dataset.scaleY=loss.scaleY.toFixed(3);root.dataset.shadowY=String(Math.round((anchorY+10)*2));
   }
   else sprite(side,checkerX,checkerY,checkerW,checkerW);
  };
  if(won||draw){const pedW=168,pedH=pedW*305/515;sprite('pedestal',(360-pedW)/2,checkerY+checkerW*0.72,pedW,pedH);piece();}
  else{
   ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(360,0);ctx.lineTo(360,lipY+8);ctx.lineTo(292,lipY+8);ctx.quadraticCurveTo(180,lipY+86,68,lipY+8);ctx.lineTo(0,lipY+8);ctx.closePath();ctx.clip();piece();ctx.restore();
   if(p.doors<0.02){drawLid(180-124,lipY-28,248,0);sprite('lip',hatchX,lipY,hatchW);}
   else{sprite('lip',hatchX,lipY,hatchW);drawLid(180-124,lipY-28,248,p.doors);}
   if(loss){
    const frac=pieceBottomFrac(side), anchorX=checkerX+checkerW/2, anchorY=checkerY+frac*checkerW;
    const face=faceFrac(side), unscaled=checkerY+face*checkerW, visual=anchorY+(unscaled-anchorY)*loss.scaleY;
    root.dataset.shadow=drawContactShadow(anchorX,visual,loss.scaleX)?'1':'0';
    root.dataset.shadowY=String(Math.round((visual+8)*2));
    drawFire(ms,loss.heat);root.dataset.fire=loss.fire?'1':'0';
   }
  }
 }
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
