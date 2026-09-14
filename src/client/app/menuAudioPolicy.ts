export class MenuAudioPolicy {
 menu = true;
 departing = false;
 platform = false;
 hidden = false;
 muted = false;
 get audible() { return this.menu && !this.platform && !this.hidden && !this.muted; }
 get music() { return this.audible && !this.departing; }
}
export function gateAudioPhase(ms: number): string {
 return ms < 400 ? 'press' : ms < 1160 ? 'unlock' : ms < 2000 ? 'motion' : 'stop';
}
