const fs=require('node:fs');
const source='evidence/coherent-menu/timing-1/summary.json';
const samples=JSON.parse(fs.readFileSync(source,'utf8'));
const budgets={source,policy:'Local software-Chrome regression ceiling: twice measured maximum, rounded up to 100ms. Not a mobile-device UX target.'};
for(const key of ['canAcceptAfter','tapAcceptedAfter','inputHandling'])budgets[key]=Math.ceil(Math.max(...samples.map(s=>s.metrics[key]))*2/100)*100;
fs.writeFileSync('evidence/coherent-menu/budgets.json',JSON.stringify(budgets,null,2)+'\n');
console.log(JSON.stringify(budgets,null,2));
