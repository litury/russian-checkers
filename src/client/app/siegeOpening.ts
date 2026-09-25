import { SiegeSelection, setSiegeSide, siegeSide, type SiegeSide } from './siegeSelection';
import { drawMenuFire, MENU_FIRE } from './menuSelectionFire';
import { MenuTouchMotion } from './menuTouchMotion';

const layers = import.meta.glob('./ui/siege/{white,black}-{base,moving,front}.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const fireUrls = [
 new URL('./ui/siege/menu-selection-fire.webp', import.meta.url).href,
];
const endpoints = import.meta.glob('../modules/board/selection-v2/frames/*/*-{00,55}.webp', { query: '?url', import: 'default' });

/** Decode before revealing; a failed decoration never changes startup readiness. */
async function decode(src: string) {
 const image = new Image();
 image.src = src;
 await image.decode();
 return image;
}
export function mountSiegeOpening(root: HTMLElement) {
 const media = matchMedia('(prefers-reduced-motion: reduce)');
 const state = new SiegeSelection(siegeSide(root));
 const touch = { white: new MenuTouchMotion(), black: new MenuTouchMotion() };
 const touchMoving = () => touch.white.moving || touch.black.moving;
 const buttons = [...root.querySelectorAll<HTMLButtonElement>('.gate-piece-slot')];
 const painters: Partial<Record<SiegeSide, (displacement: number) => void>> = {};
 let frame = 0, previous = 0, disposed = false;
 let fire: HTMLImageElement[] = [], elapsed = 0, burst = 0, lastPaint = -Infinity;
 const drawFire = (context: CanvasRenderingContext2D, side: SiegeSide) => {
  if (root.hidden || document.hidden || side !== state.side || !fire.length) return;
  drawMenuFire(context, fire[0], elapsed, burst, media.matches);
 };
 const loadFire = () => {
  if (fire.length || fireLoading) return;
  fireLoading = true;
  void Promise.all(fireUrls.map(decode)).then(images => {
   if (disposed) return;
   fire = images; wake();
  }).catch(() => {});
 };
 let fireLoading = false;
 const paint = () => {
  for (const side of ['white', 'black'] as const) painters[side]?.(state.displacement(side));
 };
 const tick = (now: number) => {
  frame = 0;
  if (disposed || root.hidden || document.hidden) { previous = 0; return; }
  const delta = previous ? Math.min(50, now - previous) : 0;
  const wasMoving = !state.settled || touchMoving();
  state.advance(delta, media.matches);
  touch.white.advance(delta, media.matches); touch.black.advance(delta, media.matches);
  elapsed += delta; burst = Math.max(0, burst - delta);
  previous = now;
  if (wasMoving || !state.settled || touchMoving() || now - lastPaint >= 1000 / 30) { paint(); lastPaint = now; }
  if (!state.settled || touchMoving() || (!media.matches && fire.length && painters[state.side])) frame = requestAnimationFrame(tick);
  else previous = 0;
 };
 const wake = () => {
  if (disposed || root.hidden || document.hidden) {
   cancelAnimationFrame(frame); frame = 0; previous = 0; burst = 0; return;
  }
  if (!frame) frame = requestAnimationFrame(tick);
 };
 const update = () => {
  const next = siegeSide(root);
  if (next !== state.side && !media.matches) burst = MENU_FIRE.ignitionMs;
  if (media.matches) burst = 0;
  state.select(next, media.matches);
  loadFire();
  // Endpoint fallback remains correct even if a layer fails or loads after another choice.
  for (const button of buttons) {
   const side = button.dataset.side as SiegeSide;
   const image = button.querySelector('img')!;
   const selected = side === state.side;
   const key = `../modules/board/selection-v2/frames/${side}/${side}-${selected ? '55' : '00'}.webp`;
   if (!painters[side]) void endpoints[key]().then(async url => {
    const loaded = await decode(url as string);
    if (disposed || (side === state.side) !== selected || painters[side]) return;
    image.src = loaded.src;
    image.classList.add('is-decoded');
   }).catch(() => {});
  }
  paint();
  wake();
 };
 const choose = (event: Event) => {
  const button = event.currentTarget as HTMLButtonElement;
  if (root.hidden || root.inert) return;
  setSiegeSide(root, button.dataset.side as SiegeSide);
 };
 const keyboard = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const side = event.key === 'Home' ? 'white' : event.key === 'End' ? 'black' : state.side === 'white' ? 'black' : 'white';
  setSiegeSide(root, side);
  buttons.find(button => button.dataset.side === side)?.focus();
 };
 for (const button of buttons) {
  button.addEventListener('click', choose);
  button.addEventListener('keydown', keyboard);
  const side = button.dataset.side as SiegeSide;
  // Only six small source layers; no frame sequence fetched. Latest state wins on decode.
  void Promise.all(['base', 'moving', 'front'].map(name => decode(layers[`./ui/siege/${side}-${name}.webp`]))).then(images => {
   if (disposed) return;
   const canvas = button.querySelector('canvas')!;
   const context = canvas.getContext('2d');
   if (!context) return;
   painters[side] = displacement => {
    context.clearRect(0, 0, MENU_FIRE.canvasWidth, MENU_FIRE.canvasHeight);
    context.save();
    context.translate(MENU_FIRE.sidePadding, MENU_FIRE.topPadding);
    drawFire(context, side);
    context.drawImage(images[0], 0, 0);
    // Base/contact shadow and front rim remain fixed: rigid disk travel, no scaling.
    context.drawImage(images[1], 141, 160 - displacement + touch[side].offset);
    context.drawImage(images[2], 0, 0);
    if (side === state.side && fire.length && !root.hidden && !document.hidden) drawMenuFire(context, fire[0], elapsed, burst, media.matches, 'front');
    context.restore();
    canvas.dataset.displacement = String(displacement);
    canvas.dataset.touchOffset = String(touch[side].offset);
    canvas.dataset.ignition = String(burst);
   };
   painters[side]!(state.displacement(side));
   canvas.hidden = false;
   button.querySelector('img')!.hidden = true;
   wake();
  }).catch(() => { if (!disposed) button.dataset.art = 'static'; });
 }
 loadFire();
 root.addEventListener('siege-side', update);
 const contact = (event: Event) => {
  const { side, held } = (event as CustomEvent<{side: SiegeSide; held: boolean}>).detail;
  if (!touch[side]) return;
  if (held) touch[side].press(); else touch[side].release(media.matches);
  paint(); wake();
 };
 root.addEventListener('menu-touch', contact);
 media.addEventListener('change', update);
 document.addEventListener('visibilitychange', wake);
 const observer = new MutationObserver(wake);
 observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
 return () => {
  disposed = true;
  fire = [];
  for (const side of ['white', 'black'] as const) delete painters[side];
  cancelAnimationFrame(frame);
  observer.disconnect();
  root.removeEventListener('siege-side', update);
  root.removeEventListener('menu-touch', contact);
  media.removeEventListener('change', update);
  document.removeEventListener('visibilitychange', wake);
  for (const button of buttons) {
   button.removeEventListener('click', choose);
   button.removeEventListener('keydown', keyboard);
  }
 };
}
const root = document.getElementById('opening');
if (root) {
 const dispose = mountSiegeOpening(root);
 if (import.meta.hot) import.meta.hot.dispose(dispose);
}
