import { pieceCaptureLevel, pieceMoveLevel, pieceSelectLevel } from './audioMix';

export const pieceMoveWhiteCue = 'move-w';
export const pieceMoveBlackCue = 'b-click';
export const pieceCaptureCue = 'crush-b';
export const pieceAhOrcCue = 'ah';
export const pieceAhElfCue = 'ah-elf';
export const pieceAhDelayMs = 100;
export const pieceSelectCue = 'select-b';

let play: (name: string, level?: number) => void = () => {};
let ahTimer: ReturnType<typeof setTimeout> | undefined;

export function bindPieceSfx(next: typeof play): void {
 cancelPieceAh();
 play = next;
}

export function cancelPieceAh(): void {
 if (ahTimer !== undefined) clearTimeout(ahTimer);
 ahTimer = undefined;
}

export function pieceMoveCue(side: 'white' | 'black'): string {
 return side === 'white' ? pieceMoveWhiteCue : pieceMoveBlackCue;
}

export function pieceAhCue(victim: 'white' | 'black'): string {
 return victim === 'black' ? pieceAhOrcCue : pieceAhElfCue;
}

export function pieceStepSfx(
 king: boolean,
 capture: boolean,
 side: 'white' | 'black' = 'white',
 victim?: 'white' | 'black',
): void {
 if (capture) {
  cancelPieceAh();
  if (!king) play(pieceMoveCue(side), pieceMoveLevel);
  play(pieceCaptureCue, pieceCaptureLevel);
  const yell = victim ? pieceAhCue(victim) : pieceAhOrcCue;
  ahTimer = setTimeout(() => {
   ahTimer = undefined;
   play(yell, 1);
  }, pieceAhDelayMs);
  return;
 }
 if (!king) play(pieceMoveCue(side), pieceMoveLevel);
}

export function pieceSelectSfx(): void {
 play(pieceSelectCue, pieceSelectLevel);
}
