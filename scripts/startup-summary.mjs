import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Student t CDF integrated deterministically; avoids a runner-specific statistics dependency.
export function t95(df) {
  const f=x=>Math.pow(1+x*x/df,-(df+1)/2);
  const integrate=(a,b)=>{const n=4096,h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+i*h);return s*h/3;};
  // The angular substitution maps the infinite normalizing integral to a finite interval.
  const n=4096,h=Math.PI/2/n;let s=0;
  for(let i=0;i<=n;i++){const x=i*h,y=Math.pow(Math.cos(x),df-1);s+=(i===0||i===n?1:i%2?4:2)*y;}
  const norm=Math.sqrt(df)*s*h/3;
  let lo=0,hi=100;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(integrate(0,mid)/norm<0.9)lo=mid;else hi=mid;}return (lo+hi)/2;
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function bound(deltas){const m=mean(deltas);const sd=Math.sqrt(deltas.reduce((s,x)=>s+(x-m)**2,0)/(deltas.length-1));return m+t95(deltas.length-1)*sd/Math.sqrt(deltas.length);}
export function summarize(rows,manifest){
 const expected=manifest.plan.observations;if(rows.length!==expected)throw Error(`Incomplete series: ${rows.length}/${expected}`);
 const groups=new Map();
 for(const r of rows){if(r.errors.length)throw Error('pageerror present');const key=[r.cache,r.width,r.dpr,r.motion].join('/');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const reports=[];
 for(const [stratum,items] of groups)for(const metric of ['firstFrameMs','lcpMs']){
  const value=r=>{if(metric==='lcpMs'){if(!r.lcp.length)throw Error('Missing LCP');return r.lcp.at(-1).time;}const mark=name=>{const a=r.marks.filter(x=>x.name===name);if(a.length!==1)throw Error('Missing/duplicate '+name);return a[0].time;};return mark('damka:board-first-frame')-mark('damka:play-intent');};
  const before=[],after=[],delta=[];
  for(let p=0;p<manifest.plan.pairs;p++){const a=items.filter(r=>r.pair===p&&r.variant==='baseline'),b=items.filter(r=>r.pair===p&&r.variant==='candidate');if(a.length!==1||b.length!==1)throw Error('Invalid pair');before.push(value(a[0]));after.push(value(b[0]));delta.push(after.at(-1)-before.at(-1));}
  const margin=Math.max(100,mean(before)*0.05),upper95=bound(delta);
  reports.push({stratum,metric,pairs:delta.length,beforeMean:mean(before),afterMean:mean(after),deltas:delta,upper95,margin,result:manifest.plan.smoke?'smoke-not-acceptance':upper95<=margin?'within-predeclared-tolerance':'inconclusive-or-regression'});
 }
 return reports;
}
if(process.argv[1]===new URL(import.meta.url).pathname){const out=resolve(process.argv[2]);const rows=JSON.parse(await readFile(resolve(out,'raw.json'))),manifest=JSON.parse(await readFile(resolve(out,'manifest.json')));const reports=summarize(rows,manifest);await writeFile(resolve(out,'summary.json'),JSON.stringify(reports,null,2));const text=['Startup paired measurements',`Observations: ${rows.length}; pairs per stratum: ${manifest.plan.pairs}`,`Throttle: ${JSON.stringify(manifest.throttling)}`,'stratum | metric | baseline | candidate | upper95 delta | margin | result',...reports.map(r=>`${r.stratum} | ${r.metric} | ${r.beforeMean.toFixed(2)} | ${r.afterMean.toFixed(2)} | ${r.upper95.toFixed(2)} | ${r.margin.toFixed(2)} | ${r.result}`)].join('\n')+'\n';await writeFile(resolve(out,'summary.txt'),text);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);console.log(text);}
