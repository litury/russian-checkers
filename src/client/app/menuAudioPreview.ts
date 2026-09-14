/** Technical preview only: overlap tail/head, no resampling or tempo change. */
export function previewLoop(input:Float32Array,fade:number):Float32Array {
 const n=Math.max(2,Math.min(Math.floor(fade),Math.floor(input.length/2)));
 const out=input.slice(n);
 for(let i=0;i<n;i++){
  const t=i/(n-1),w=t*t*(3-2*t);
  out[out.length-n+i]=input[input.length-n+i]*(1-w)+input[i]*w;
 }
 return out;
}
export function mechanismEnvelope(ms:number,start:number,end:number):number {
 return Math.max(0,Math.min(1,(ms-start)/40,(end-ms)/120));
}
