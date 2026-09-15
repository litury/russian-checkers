export class MenuAudioPolicy {
 menu = true;
 match = false;
 departing = false;
 platform = false;
 hidden = false;
 muted = false;
 get live() { return !this.platform && !this.hidden && !this.muted; }
 get audible() { return this.live && (this.menu || this.match); }
 get music() { return this.live && this.menu && !this.departing; }
}
export function gateAudioPhase(ms: number): string {
 return ms < 400 ? 'press' : ms < 1160 ? 'unlock' : ms < 2000 ? 'motion' : 'stop';
}
