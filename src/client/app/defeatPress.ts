export function createDefeatPress(feedback: (index:number,down:boolean)=>void, activate:(index:number)=>void) {
 let active = -1, committed = false;
 const cancel = () => { if (active >= 0) feedback(active,false); active = -1; };
 return {
  down(index:number) { if (committed || active >= 0) return; active=index; feedback(index,true); },
  up(index:number) { const valid = !committed && active === index && index >= 0; cancel(); if(valid) { committed=true; activate(index); } },
  cancel,
  reset() { cancel(); committed=false; },
 };
}
