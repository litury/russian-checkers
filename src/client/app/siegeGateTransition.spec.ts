import { afterEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { siegeGatePose, siegeTravel } from './siegeGateTransition';
import masks from './ui/siege/gate-masks.json';
const audio = vi.hoisted(()=>({gate:vi.fn(),hide:vi.fn()}));
vi.mock('./menuAudio', () => ({ createMenuAudio: () => new Proxy(audio, {get: (target,key) => target[key as keyof typeof target] ?? vi.fn()}) }));
vi.mock('./matchHistoryUi', () => ({bindMatchHistory: vi.fn()}));
vi.mock('@/online/cloud', () => ({ensureGuest:async()=>null,loadColorStats:async()=>null,loadPresence:async()=>null,beatPresence:async()=>null}));
vi.mock('./siegeSelection', () => ({siegeSide:()=> 'white',setSiegeSide:vi.fn()}));
import { createOpeningOverlay } from './openingOverlay';
import { paintOpeningStats } from './openingStats';
class Element extends EventTarget {
 hidden=false; inert=false; disabled=false; open=false; textContent=''; onclick:(()=>void)|null=null; scrollTop=0; parentElement: Element | null=null;
 values = new Map<string,string>(); classes=new Set<string>();
 animations: any[]=[];
 animate=vi.fn((frames: unknown, options: any)=>{const a={frames,options,currentTime:0,playState:'running',onfinish:null as null|(()=>void),pause:vi.fn(()=>{a.playState='paused';}),play:vi.fn(()=>{a.playState='running';}),cancel:vi.fn(()=>{a.playState='idle';})};this.animations.push(a);return a;});
 style={setProperty:(k:string,v:string)=>this.values.set(k,v)};
 classList={add:(k:string)=>this.classes.add(k), remove:(k:string)=>this.classes.delete(k),contains:(k:string)=>this.classes.has(k),toggle:vi.fn()};
 focus=vi.fn(); close(){this.open=false;}
 children=new Map<string,Element>();
 querySelector(selector:string){if(!this.children.has(selector))this.children.set(selector,new Element());return this.children.get(selector)!;}
 getBoundingClientRect(){return {left:0,right:1440,top:0,bottom:220};}
 layers: Element[]=[];
 querySelectorAll(selector:string){return selector === '.siege-layer' ? this.layers : selector === '.siege-left,.siege-right' ? this.layers.slice(0,2) : [this.querySelector(selector)];}
}
function setup(reduced=false, decoded=true) {
 const nodes = new Map<string,Element>();
 const get=(id:string)=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)!;};
 const root=get('opening'); root.layers=Array.from({length:3},()=>new Element());
 if(decoded)root.layers.forEach(x=>x.classList.add('is-decoded'));
 const doc=Object.assign(new EventTarget(),{hidden:false,getElementById:get,timeline:{currentTime:123}});
 vi.stubGlobal('document',doc);
 const media=Object.assign(new EventTarget(),{matches:reduced});
 vi.stubGlobal('matchMedia',()=>media);
 const resizeListeners: Array<() => void> = [];
 vi.stubGlobal('window',{checkersStartup:{unlock:vi.fn(),ready:vi.fn(),waitPlay:vi.fn(),status:vi.fn()},setInterval:vi.fn(),clearInterval:vi.fn(),addEventListener:(type:string,fn:()=>void)=>{if(type==='resize')resizeListeners.push(fn);},removeEventListener:(type:string,fn:()=>void)=>{if(type!=='resize')return;const i=resizeListeners.indexOf(fn);if(i>=0)resizeListeners.splice(i,1);}});
 let tick=()=>{};
 const events=new Map<string,()=>void>();
 const paused={value:false};
 const scene={registry:{get:()=>null},game:{canvas:{focus:vi.fn()}},time:{now:0},events:{on:(s:string,cb:()=>void)=>{events.set(s,cb);if(s==='update')tick=cb;},once:(s:string,cb:()=>void)=>events.set(s,cb),off:(s:string)=>events.delete(s)}};
 const onPlayBot=vi.fn();
 const overlay=createOpeningOverlay(scene as unknown as Phaser.Scene,{onPlayBot,isPaused:()=>paused.value});
 return {root,overlay,scene,get,onPlayBot,media,doc,events,paused,resizeListeners,visual:(ms:number)=>{for(const node of [root,...root.children.values()])for(const a of node.animations)if(a.playState==='running')a.currentTime+=ms;},advance:(ms:number)=>{scene.time.now+=ms;tick();}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('keeps the original complementary tooth path and samples arbitrary travel',()=>{
 expect(new Set(masks.seam_xy.map(p=>p[0])).size).toBeGreaterThan(3);
 for(let i=1;i<masks.seam_xy.length;i++)expect(masks.seam_xy[i][1]).toBeGreaterThan(masks.seam_xy[i-1][1]);
 expect(siegeGatePose(-1,1442)).toBe(0);
 expect(siegeGatePose(1000,1442)).toBe(721);
 expect(siegeGatePose(3000,1442)).toBe(1442);
});
it.each([[1920,1080],[2560,1440],[390,844],[844,390]])('cover and travel clear every surface and mount at %s × %s',(width,height)=>{
 const artWidth=Math.max(1440,width,height*1.5);
 const artHeight=artWidth/1.5;
 expect(artWidth).toBeGreaterThanOrEqual(width);
 expect(artHeight).toBeGreaterThanOrEqual(height);
 const bounds=[{left:(width-artWidth)/2,right:(width+artWidth)/2},{left:6,right:192},{left:width-192,right:width-6}];
 for(const side of ['left','right'] as const){
  const distance=siegeTravel({left:0,right:width},bounds,side);
  for(const rect of bounds)expect(side==='left'?rect.right-distance:width-rect.left-distance).toBeLessThan(0);
 }
});
it('still opens decoded leaves when the unused frame failed loading',()=>{
 const {root,overlay,visual,advance}=setup(); const done=vi.fn();
 root.layers[2].classList.remove('is-decoded');
 overlay.depart(done);
 expect(root.hidden).toBe(false); expect(done).not.toHaveBeenCalled();
 visual(1000); advance(1000); expect(root.hidden).toBe(false);
 visual(1000); advance(1000); expect(done).toHaveBeenCalledTimes(1);
});
it('moves in opposite directions once, hides only after completion, and resets on return',()=>{
 const {root,overlay,advance,visual,get,onPlayBot}=setup(); const done=vi.fn(),duplicate=vi.fn();
 overlay.depart(done); overlay.depart(duplicate); get('opening-play').onclick?.();
 expect(onPlayBot).not.toHaveBeenCalled(); expect(root.inert).toBe(true);
 visual(1000);advance(1000);
 expect(root.values.has('--siege-left')).toBe(false);
 expect(root.querySelector('.siege-left').animations[0].currentTime).toBe(1000);
 expect(root.hidden).toBe(false); expect(done).not.toHaveBeenCalled();
 visual(1000);advance(1000);advance(1000);
 expect(root.hidden).toBe(true);expect(root.classes.has('is-departing')).toBe(false);
 expect(done).toHaveBeenCalledTimes(1);expect(duplicate).not.toHaveBeenCalled();
 overlay.show();expect(root.hidden).toBe(false);expect(root.inert).toBe(false);expect(root.querySelector('.siege-left').animations[0].cancel).toHaveBeenCalled();
 overlay.depart(done);visual(2000);advance(2000);expect(done).toHaveBeenCalledTimes(2);
});
it('cancels an in-flight departure on return without firing a stale completion',()=>{
 const {root,overlay,advance}=setup();const done=vi.fn();
 overlay.depart(done);advance(600);overlay.show();advance(3000);
 expect(done).not.toHaveBeenCalled();expect(root.hidden).toBe(false);expect(root.querySelector('.siege-right').animations[0].cancel).toHaveBeenCalled();
});
it.each([[true,true],[false,false]])('direct switch for reduced motion %s / decoded art %s', (reduced,decoded)=>{
 const {root,overlay}=setup(reduced,decoded); const done=vi.fn();overlay.depart(done);
 expect(root.hidden).toBe(true);expect(done).toHaveBeenCalledTimes(1);expect(root.classes.has('is-departing')).toBe(false);
});

it('hands transforms to browser once: sparse scene updates cannot seek the leaves',()=>{
 const {root,overlay,advance,visual}=setup(); const done=vi.fn(); overlay.depart(done);
 const leaf=root.querySelector('.siege-left');
 expect(leaf.animate).toHaveBeenCalledTimes(1);
 const a=leaf.animations[0];
 visual(1700); expect(done).not.toHaveBeenCalled();
 advance(40); expect(a.currentTime).toBe(1700);
 expect(audio.gate).toHaveBeenLastCalledWith(1700,false);
 expect(root.values.size).toBe(0);
 expect(a.frames).toEqual([{transform:'translateX(0px)'},{transform:'translateX(-1442px)'}]);
 expect(root.animations).toHaveLength(0);
 const mount=root.querySelector('[data-siege-mount="left"]').animations[0];
 expect(mount.frames).toEqual(a.frames);
 expect(mount.options).toEqual(a.options);
 expect(mount.startTime).toBe(a.startTime);
 expect(a.startTime).toBe(123);
 expect(a.options.delay).toBe(350);
 expect(a.options.duration).toBe(1650);
 const canopy=root.querySelector('.gate-title-canopy').animations[0];
 expect(canopy.options.duration).toBe(a.options.delay);
 expect(canopy.frames).toEqual([{transform:'translateY(0px)'},{transform:'translateY(-222px)'}]);
 expect(canopy.startTime).toBe(a.startTime);
 const right=root.querySelector('.siege-right').animations[0];
 const rightMount=root.querySelector('[data-siege-mount="right"]').animations[0];
 expect(rightMount.frames).toEqual(right.frames);
 expect(rightMount.options).toEqual(a.options);
 expect(rightMount.startTime).toBe(a.startTime);
 expect(right.frames[1].transform).toBe('translateX(1442px)');
 visual(300); advance(40); expect(done).toHaveBeenCalledTimes(1);
});
it('pauses on visibility, resumes without seeking, finishes immediately on motion change',()=>{
 const {root,overlay,doc,media,visual}=setup();const done=vi.fn();overlay.depart(done);
 const a=root.querySelector('.siege-left').animations[0];
 visual(500);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
 expect(a.playState).toBe('paused');visual(600);expect(a.currentTime).toBe(500);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));expect(a.playState).toBe('running');
 media.matches=true;media.dispatchEvent(new Event('change'));
 expect(done).toHaveBeenCalledTimes(1);expect(root.hidden).toBe(true);expect(a.cancel).toHaveBeenCalled();
});

it('honors handler pause and scene pause/resume without scene time seeking',()=>{
 const {root,overlay,events,paused,advance,visual}=setup();const done=vi.fn();overlay.depart(done);
 const a=root.querySelector('.siege-left').animations[0];
 visual(300);paused.value=true;advance(50);visual(900);
 expect(a.currentTime).toBe(300);expect(done).not.toHaveBeenCalled();
 paused.value=false;advance(50);visual(200);expect(a.currentTime).toBe(500);
 events.get('pause')!();visual(900);expect(a.currentTime).toBe(500);
 events.get('resume')!();visual(1500);advance(1);expect(done).toHaveBeenCalledTimes(1);
});
it.each(['hide','shutdown'] as const)('cancels %s without completing or retaining effects', action=>{
 const {root,overlay,events,visual,advance,media}=setup();const done=vi.fn();overlay.depart(done);
 visual(800);
 if(action==='hide')overlay.hide();else events.get('shutdown')!();
 for(const node of [root,...root.children.values(),...root.layers])for(const a of node.animations)expect(a.cancel).toHaveBeenCalledTimes(1);
 visual(3000);advance(3000);media.matches=true;media.dispatchEvent(new Event('change'));
 expect(done).not.toHaveBeenCalled();expect(root.inert).toBe(false);
});
it('clears chronicle halves concurrently with title before background gates',()=>{
 const {root,overlay}=setup(); overlay.depart(vi.fn());
 const half=root.querySelector('[data-chronicle-mount="left"]');
 expect(half.animate).toHaveBeenCalledTimes(1);
 expect(half.animations[0].options.delay).toBe(0);
 expect(half.animations[0].options.duration).toBe(350);
 expect(root.querySelector('.siege-left').animations[0].options.delay).toBe(350);
 expect(half.animations[0].startTime).toBe(root.querySelector('.gate-title-canopy').animations[0].startTime);
});
it('freezes opening scroll through departure and resize',()=>{
 const {root,overlay,resizeListeners}=setup();
 root.scrollTop=244;
 const add=root.classList.add.bind(root.classList);
 root.classList.add=(name:string)=>{ const added=add(name); if(name==='is-departing') root.scrollTop=0; return added; };
 overlay.depart(vi.fn());
 expect(root.scrollTop).toBe(244);
 expect(root.classes.has('is-departing')).toBe(true);
 root.scrollTop=12;
 for (const fn of resizeListeners) fn();
 expect(root.scrollTop).toBe(244);
});
it('keeps chronicle labels and refuses a fake zero or sample online count', async ()=>{
 const {overlay,get,root}=setup();
 const parent={hidden:true};
 const white={textContent:'0',parentElement:parent};
 const blackParent={hidden:true};
 const black={textContent:'0',parentElement:blackParent};
 const unavailable={hidden:true,textContent:'',dataset:{error:'Статистика недоступна'}};
 paintOpeningStats('error', null, {root, label:unavailable, retry:{hidden:true,disabled:false}, white, black});
 expect(parent.hidden).toBe(false);
 expect(blackParent.hidden).toBe(false);
 expect(white.textContent).toBe('—');
 expect(white.textContent).not.toBe('0');
 expect(black.textContent).toBe('—');
 expect(unavailable.hidden).toBe(false);
 expect(unavailable.textContent).toBe('Статистика недоступна');
 const live=get('opening-live-count');
 live.hidden=false;
 live.textContent='Онлайн: 12 · пример';
 overlay.show();
 await Promise.resolve();
 await Promise.resolve();
 expect(live.hidden).toBe(true);
 expect(live.textContent).not.toContain('12');
 expect(live.textContent).not.toContain('пример');
});
it('falls back immediately if animation creation fails, cleaning partial effects',()=>{
 const {root,overlay}=setup();const done=vi.fn();
 root.querySelector('.siege-right').animate.mockImplementation(()=>{throw new Error('unsupported');});
 overlay.depart(done);expect(done).toHaveBeenCalledTimes(1);expect(root.hidden).toBe(true);
 expect(root.querySelector('.siege-left').animations[0].cancel).toHaveBeenCalledTimes(1);
});
