type Contact = (event:Event, current:()=>boolean)=>void;
let contact:Contact = ()=>{};
/** Bridge only; createMenuAudio remains the sole context/policy/source owner. */
export function bindMenuPressSound(handler:Contact) { contact=handler; }
export function emitMenuPressSound(event:Event,current:()=>boolean) { contact(event,current); }
