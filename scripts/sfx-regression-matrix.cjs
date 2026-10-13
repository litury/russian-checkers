// Isolated native Chrome. Forced position only; moves are real pointer input.
const {chromium}=require('/home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const origin=process.env.SFX_URL||'http://127.0.0.1:5307';
const output=process.env.SFX_OUTPUT||'artifacts/sfx-after.json';
const baseline=process.env.SFX_BASELINE==='1';
const coldMiss=process.env.SFX_COLD_MISS==='1';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
 const results=[];
 try{
 for(const reducedMotion of ['no-preference','reduce'])for(const side of ['white','black'])for(const temperature of ['cold','warm'])for(const type of ['capture','promotion']){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion});
  const held=[];let release=false;
  await context.route('**/*',r=>{
   const url=r.request().url();if(!url.startsWith(origin+'/'))return r.abort();
   if(coldMiss&&!release&&r.request().resourceType()!=='script'&&/\/(crush-b|ignite-a)\.wav/.test(url)){held.push(r);return;}
   if(type==='promotion'&&temperature==='cold'&&/\/king-fire(?:-polish)?\//.test(url))return r.abort();
   return r.continue();
  });
  await context.routeWebSocket(/.*/,s=>s.close());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.sfxEvidence={decoded:[],sources:[],output:[]};const C=window.AudioContext;
   const entries=[];const decodeMetrics=b=>{const d=b.getChannelData(0);let sum=0,peak=0,attack=-1;for(let i=0;i<d.length;i++){sum+=d[i]*d[i];peak=Math.max(peak,Math.abs(d[i]));if(attack<0&&Math.abs(d[i])>.001)attack=i/b.sampleRate;}return {duration:b.duration,rms:Math.sqrt(sum/d.length),peak,attack};};
   window.AudioContext=class extends C{
    constructor(...args){super(...args);const module=URL.createObjectURL(new Blob([`class Tap extends AudioWorkletProcessor { process(inputs) { const d=inputs[0]?.[0]; if(d){let sum=0,peak=0;for(const x of d){sum+=x*x;peak=Math.max(peak,Math.abs(x));}if(peak>0)this.port.postMessage({time:currentTime,rms:Math.sqrt(sum/d.length),peak});}return true;} } registerProcessor('sfx-tap',Tap);`],{type:'text/javascript'}));this.tapReady=this.audioWorklet.addModule(module);const dest=this.destination;const total=this.createAnalyser();total.fftSize=2048;total.connect(dest);const connect=AudioNode.prototype.connect;
     AudioNode.prototype.connect=function(target,...args){return connect.call(this,target===dest?total:target,...args);};
     const sample=()=>{for(const e of entries){if(!e.started||e.ended)continue;const d=new Float32Array(e.tap.fftSize);e.tap.getFloatTimeDomainData(d);let sum=0,peak=0;for(const x of d){sum+=x*x;peak=Math.max(peak,Math.abs(x));}e.row.output.push({at:performance.now(),rms:Math.sqrt(sum/d.length),peak});}
      const d=new Float32Array(total.fftSize);total.getFloatTimeDomainData(d);let sum=0,peak=0;for(const x of d){sum+=x*x;peak=Math.max(peak,Math.abs(x));}window.sfxEvidence.output.push({at:performance.now(),rms:Math.sqrt(sum/d.length),peak});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    }
    async decodeAudioData(bytes){const b=await super.decodeAudioData(bytes);await this.tapReady;window.sfxEvidence.decoded.push({...decodeMetrics(b),at:performance.now()});return b;}
    createBufferSource(){const s=super.createBufferSource();const start=s.start.bind(s),stop=s.stop.bind(s),connect=s.connect.bind(s);const e={started:false,ended:false,row:null,tap:null,gain:null};
     s.connect=(target,...args)=>{e.gain=target;const tap=this.createAnalyser();tap.fftSize=2048;const silent=this.createGain();silent.gain.value=0;target.connect(tap);tap.connect(silent).connect(this.destination);e.tap=tap;const recorder=new AudioWorkletNode(this,'sfx-tap');recorder.port.onmessage=event=>{if(e.row)e.row.output.push({...event.data,at:performance.now(),nativeRender:true});};target.connect(recorder).connect(this.destination);return connect(target,...args);};
     s.start=(...args)=>{e.row={...decodeMetrics(s.buffer),at:performance.now(),loop:s.loop,state:this.state,gain:e.gain?.gain?.value,output:[],stopped:null};window.sfxEvidence.sources.push(e.row);e.started=true;entries.push(e);s.addEventListener('ended',()=>{e.ended=true;});return start(...args);};
     s.stop=(...args)=>{if(e.row)e.row.stopped={at:performance.now(),when:args[0]};return stop(...args);};return s;
    }
   };
  });
  await page.goto(origin+'/');
  await page.locator('#opening-play').click();
  await page.waitForFunction(()=>window.__checkersScene?.phase==='human'&&!window.__checkersScene.countingIn);
  await page.evaluate(()=>{const st=window.checkersSettings.get();window.checkersSettings.set({...st,music:0,autoMove:false});const s=window.__checkersScene;s.botTimer?.remove();s.playBot=()=>{};});
  if(!coldMiss)await page.waitForFunction(()=>[.2954875283446712,.4902267573696145].every(d=>window.sfxEvidence.decoded.some(b=>Math.abs(b.duration-d)<1e-7)));
  if(temperature==='warm')await page.waitForFunction(()=>window.__checkersScene.textures.exists('king-fire_ignite-back')||matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.evaluate(({side,type})=>{
   const s=window.__checkersScene;s.botTimer?.remove();s.board.reset();s.acceptedResult=null;s.humanChain=null;s.selected=null;s.humanSide=side;s.phase='human';s.moving=false;s.flagLock=false;s.countingIn=false;s.paused=false;
   const squares=Array.from({length:8},()=>Array(8).fill(null));const row=side==='white'?(type==='promotion'?6:2):(type==='promotion'?1:5);squares[row][0]={side,kind:'man'};
   if(type==='capture'){squares[side==='white'?3:4][1]={side:side==='white'?'black':'white',kind:'man'};squares[side==='white'?3:4][3]={side:side==='white'?'black':'white',kind:'man'};}
   squares[side==='white'?7:0][7]={side:side==='white'?'black':'white',kind:'man'};s.position={turn:side,squares};s.refresh();window.testStarted=performance.now();
  },{side,type});
  const tap=async(row,col)=>{
   const p=await page.evaluate(({row,col})=>{const s=window.__checkersScene;const rect=s.children.list.filter(o=>o.type==='Rectangle'&&o.depth===2)[row*8+col];const b=s.game.canvas.getBoundingClientRect();return {x:b.x+rect.x*b.width/s.scale.width,y:b.y+rect.y*b.height/s.scale.height};},{row,col});
   await page.mouse.click(p.x,p.y);
  };
  await tap(side==='white'?(type==='promotion'?6:2):(type==='promotion'?1:5),0);
  await page.waitForFunction(()=>!!window.__checkersScene.selected);
  await tap(side==='white'?(type==='promotion'?7:4):(type==='promotion'?0:3),type==='promotion'?1:2);
  await page.waitForFunction(({row,col})=>!window.__checkersScene.moving&&(window.__checkersScene.humanChain?.selected?.col===col||window.__checkersScene.position.squares[row][col]),{row:side==='white'?(type==='promotion'?7:4):(type==='promotion'?0:3),col:type==='promotion'?1:2});
  if(type==='capture'){await tap(side==='white'?2:5,4);await page.waitForFunction(({row})=>!window.__checkersScene.moving&&!!window.__checkersScene.position.squares[row][4],{row:side==='white'?2:5});}
  const duration=type==='capture'?.2954875283446712:.4902267573696145;
  if(coldMiss){
   release=true;for(const r of held)await r.continue();
   await page.waitForFunction(d=>window.sfxEvidence.decoded.some(b=>Math.abs(b.duration-d)<1e-7),duration);
  }
  await page.waitForFunction(()=>performance.now()-window.testStarted>1200);
  const result=await page.evaluate(({side,type,reducedMotion,temperature})=>({side,type,reducedMotion,temperature,settings:window.checkersSettings.get(),started:window.testStarted,fireReady:window.__checkersScene.textures.exists('king-fire_ignite-back'),position:window.__checkersScene.position,evidence:window.sfxEvidence}),{side,type,reducedMotion,temperature});
  result.errors=errors;result.nativePointer=true;result.coldMiss=coldMiss;
  if(type==='promotion'&&temperature==='cold')assert.equal(result.fireReady,false,'test must actually withhold optional fire sheets');
  const cues=result.evidence.sources.filter(s=>s.at>=result.started&&Math.abs(s.duration-duration)<1e-7);
  result.cues=cues.map(s=>({at:s.at-result.started,gain:s.gain,state:s.state,peak:Math.max(0,...s.output.map(p=>p.peak)),rms:Math.max(0,...s.output.map(p=>p.rms)),stopped:s.stopped}));
  fs.writeFileSync(output+'.latest',JSON.stringify(result,null,2));
  const expected=coldMiss?0:type==='capture'?2:baseline&&temperature==='cold'&&reducedMotion==='no-preference'?0:1;
  assert.equal(cues.length,expected,JSON.stringify({side,type,reducedMotion,temperature}));
  if(!coldMiss)for(const s of result.cues){assert.equal(s.state,'running');assert.ok(s.peak>.001,'nonzero real rendered PCM');}
  assert.equal(errors.length,0);results.push(result);
  fs.writeFileSync(output,JSON.stringify(results,null,2));console.log({side,type,reducedMotion,temperature,cues:result.cues});
  await context.close();
 }
 }finally{await browser.close();}
 assert.equal(results.length,16);console.log('PASS native matrix 16/16');
})().catch(e=>{console.error(e);process.exit(1)});
