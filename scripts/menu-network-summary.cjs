// Summarize real CDP + Resource Timing data; no inferred DNS/TLS zeros.
const fs=require('node:fs');
const path=require('node:path');
const dir=process.argv[2];
const output=[];
for(const file of fs.readdirSync(dir).filter(f=>/^\d+-\d+-(cold|warm)\.json$/.test(f))){
 let d;try{d=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));}catch(e){console.error('INVALID',file,e.message);continue;}
 const s=d.summary;
 const resources=d.resources.filter(r=>r.name.startsWith('http'));
 const critical=resources.filter(r=>r.startTime<s.firstWhole);
 const preMove=resources.filter(r=>r.startTime<s.allowed);
 const types={};
 for(const r of preMove){const type=/\.(mp3|wav|ogg)/.test(r.name)?'audio':/\.(webp|png)/.test(r.name)?'image':/\.woff2/.test(r.name)?'font':/\.js/.test(r.name)?'js':/\.css/.test(r.name)?'css':'html/api';const a=types[type]??={count:0,bytes:0};a.count++;a.bytes+=r.transferSize;}
 const nav=d.resources.find(r=>r.entryType==='navigation');
 const duplicates=Object.entries(Object.groupBy(resources,r=>r.name)).filter(([,v])=>v.length>1).map(([url,v])=>({url:path.basename(url),requests:v.length,bytes:v.reduce((n,r)=>n+r.transferSize,0)}));
 output.push({file,...s,gate:s.gate&&{start:s.gate.startTime,end:s.gate.responseEnd,bytes:s.gate.transferSize,body:s.gate.decodedBodySize},clickToAllowed:s.allowed-s.click,clickToPlayed:s.played?s.played-s.click:null,critical:{count:critical.length,bytes:critical.reduce((n,r)=>n+r.transferSize,0)},preMove:{count:preMove.length,bytes:preMove.reduce((n,r)=>n+r.transferSize,0),types},duplicates,network:resources.filter(r=>r.startTime<s.firstWhole||/\/main-.*\.js/.test(r.name)).map(r=>({name:path.basename(r.name),start:r.startTime,ttfb:r.responseStart?r.responseStart-r.requestStart:null,end:r.responseEnd,transfer:r.transferSize,decoded:r.decodedBodySize,initiator:r.initiatorType})),decodes:d.diag.decodes.filter(r=>r.start<s.firstWhole),metrics:d.metrics.metrics.filter(m=>/LayoutDuration|RecalcStyleDuration|ScriptDuration|TaskDuration/.test(m.name)),navigation:nav&&{start:nav.startTime,ttfb:nav.responseStart-nav.requestStart}});
}
fs.writeFileSync(path.join(dir,'analysis.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output.map(({network,decodes,metrics,duplicates,...r})=>r),null,2));
