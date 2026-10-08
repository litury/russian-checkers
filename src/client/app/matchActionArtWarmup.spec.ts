import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
describe('match action entry warmup', () => {
 let pending: Array<{resolve:()=>void; reject:()=>void}>;
 let images: Array<{src:string; fetchPriority:string}>;
 let events: Record<string,(event:any)=>void>;
 let hidden: boolean;
 beforeEach(()=>{
  vi.resetModules(); pending=[]; images=[]; events={}; hidden=false;
  performance.clearMarks();
  vi.stubGlobal('document',{get hidden(){return hidden;},addEventListener:(name:string,fn:any)=>{events[name]=fn;}});
  vi.stubGlobal('window',{addEventListener:(name:string,fn:any)=>{events[name]=fn;},requestIdleCallback:()=>{}});
  vi.stubGlobal('Image',class {
   src=''; fetchPriority=''; decoding='';
   constructor(){images.push(this);}
   decode(){return new Promise<void>((resolve,reject)=>pending.push({resolve,reject:()=>reject(new Error('offline'))}));}
  });
 });
 afterEach(()=>vi.unstubAllGlobals());
 const settle=async()=>{pending.shift()?.resolve(); await new Promise(resolve=>setTimeout(resolve,0));};
 it('keeps all fifteen unchanged URLs; immediate two-flight low priority and idempotency',async()=>{
  const m=await import('./matchActionArtWarmup');
  expect(m.matchActionArtUrls.map(url=>url.split('/').pop()).sort()).toEqual(['dialog.png','dialog-neutral.png','dialog-copper.png',...['undo','resign'].flatMap(action=>['rest','hover','pressed','focus','disabled','icon'].map(state=>`${action}-${state}.png`))].sort());
  m.warmMatchActionArt(); m.warmMatchActionArt();
  expect(images).toHaveLength(2); expect(images[0].src).toContain('dialog.png');
  expect(images.every(image=>image.fetchPriority==='low')).toBe(true);
  await settle(); expect(images).toHaveLength(3);
 });
 it('absorbs failures without retries and finishes incomplete rather than claiming warm',async()=>{
  const m=await import('./matchActionArtWarmup');m.warmMatchActionArt();
  pending.shift()?.reject();await new Promise(resolve=>setTimeout(resolve,0));
  while(pending.length) await settle();
  expect(images).toHaveLength(15);
  expect(performance.getEntriesByName('damka:match-action-art-incomplete')).toHaveLength(1);
  expect(performance.getEntriesByName('damka:match-action-art-warm')).toHaveLength(0);
 });
 it('resumes remaining URLs after persisted pageshow, no duplicate active flights',async()=>{
  const m=await import('./matchActionArtWarmup');m.warmMatchActionArt();events.pagehide({});
  await settle();expect(images).toHaveLength(2);
  events.pageshow({persisted:false});expect(images).toHaveLength(2);
  events.pageshow({persisted:true});expect(images).toHaveLength(3);
  events.pageshow({persisted:true});expect(images).toHaveLength(3);
  while(pending.length)await settle();
  expect(new Set(images.map(image=>image.src)).size).toBe(15);
  expect(performance.getEntriesByName('damka:match-action-art-warm')).toHaveLength(1);
 });
 it('resumes a hidden document and warms the complete dialog set',async()=>{
  const m=await import('./matchActionArtWarmup');hidden=true;m.warmMatchActionArt();expect(images).toHaveLength(0);
  hidden=false;events.visibilitychange({});expect(images).toHaveLength(2);
  expect(m.resignArtReady()).toBe(false);
  while(pending.length)await settle();expect(m.resignArtReady()).toBe(true);
  await expect(m.prepareResignArt()).resolves.toBe(true);expect(images).toHaveLength(15);
 });
 it('explicit preparation retries failed dialog decode without redownloading decoded URLs',async()=>{
  const m=await import('./matchActionArtWarmup');
  const first=m.prepareResignArt();
  pending.shift()?.reject();await settle();await settle();
  await expect(first).resolves.toBe(false);
  expect(m.resignArtReady()).toBe(false);
  const retry=m.prepareResignArt();expect(images).toHaveLength(4);
  await settle();await expect(retry).resolves.toBe(true);
  expect(m.resignArtReady()).toBe(true);
 });
 it('feedback decode shares the rest URL and states stay cold until decoded',async()=>{
  const m=await import('./matchActionArtWarmup');
  expect(m.resignStatesReady()).toBe(false);
  const rest=m.prepareResignFeedback();expect(images).toHaveLength(0);
  m.warmMatchActionArt();expect(images).toHaveLength(2);expect(images[1].src).toContain('resign-rest');
  await settle();await settle();await expect(rest).resolves.toBe(true);
  expect(m.resignStatesReady()).toBe(false);
  while(pending.length)await settle();
  expect(m.resignStatesReady()).toBe(true);
  expect(images.filter(image=>image.src.includes('resign-rest'))).toHaveLength(1);
 });
 it('on-demand dialog preparation shares in-flight URLs with background queue',async()=>{
  const m=await import('./matchActionArtWarmup');m.warmMatchActionArt();const result=m.prepareResignArt();
  // Entry starts dialog+rest; explicit dialog prep shares dialog and adds only its two plates.
  expect(images).toHaveLength(4);await settle();await settle();await settle();await settle();await expect(result).resolves.toBe(true);
  while(pending.length)await settle();expect(new Set(images.map(image=>image.src)).size).toBe(images.length);
 });
});
