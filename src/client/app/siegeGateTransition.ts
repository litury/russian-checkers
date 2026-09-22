import { gateDurationMs } from './openingGates';
export const titleDepartureMs = 350;

/** Conservative bounds include transparent image extents and every attached control. */
export function siegeTravel(viewport: {left: number; right: number}, bounds: readonly {left: number; right: number}[], side: 'left' | 'right') {
 return Math.ceil(Math.max(0, ...bounds.map(rect => side === 'left'
  ? rect.right - viewport.left : viewport.right - rect.left))) + 2;
}
export function siegeGatePose(ms: number, distance: number) {
 const t = Math.max(0, Math.min(1, ms / gateDurationMs));
 return distance * t * t * (3 - 2 * t);
}

/** All mounts share the leaf's distance, easing and browser timeline start.
 * Separate DOM mounts preserve the existing logical focus order and semantics.
 * No scene-frame style writes or opacity tracks.
 */
export function animateSiegeGates(root: HTMLElement) {
 const animations: Animation[] = [];
 try {
  const viewport = root.getBoundingClientRect();
  const groups = (['left', 'right'] as const).map(side => {
   const nodes = [root.querySelector<HTMLElement>(`.siege-${side}`)!,
    ...root.querySelectorAll<HTMLElement>(`[data-siege-mount="${side}"]`)];
   const distance = siegeTravel(viewport, nodes.map(node => node.getBoundingClientRect()), side);
   return { nodes, x: side === 'left' ? -distance : distance };
  });
  for (const {nodes, x} of groups) for (const node of nodes) {
   animations.push(node.animate(
    [{transform:'translateX(0px)'}, {transform:`translateX(${x}px)`}],
    {delay:titleDepartureMs, duration:gateDurationMs-titleDepartureMs, easing:'cubic-bezier(0.3333333333,0,0.6666666667,1)', fill:'both'},
   ));
  }
  const canopy = root.querySelector<HTMLElement>('.gate-title-canopy');
  if (canopy) animations.push(canopy.animate(
   [{transform:'translateY(0px)'}, {transform:`translateY(-${Math.ceil(canopy.getBoundingClientRect().bottom - viewport.top) + 2}px)`}],
   {duration:titleDepartureMs, easing:'ease-in', fill:'both'},
  ));
  const start = document.timeline.currentTime;
  if (start !== null) for (const animation of animations) animation.startTime = start;
 } catch {
  animations.forEach(a=>a.cancel());
  return null; // Unsupported animation API/decor failure must not block play.
 }
 return {
  get elapsed() { return Number(animations[0].currentTime ?? 0); },
  pause(paused: boolean) {
   for (const a of animations) {
    if (paused && a.playState === 'running') a.pause();
    else if (!paused && a.playState === 'paused') a.play();
   }
  },
  cancel() { animations.forEach(a=>a.cancel()); },
 };
}
