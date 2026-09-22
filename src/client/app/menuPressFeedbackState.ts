/** Contact state only: native button click remains the selection authority. */
export class MenuPressState {
 private source: string | null = null;
 get active() { return this.source !== null; }
 constructor(private changed:(active:boolean)=>void, private contact:()=>void) {}
 down(source:string) { if(this.active)return;this.source=source;this.changed(true);this.contact(); }
 up(source:string) { if(this.source===source)this.cancel(); }
 cancel() { if(!this.active)return;this.source=null;this.changed(false); }
}
