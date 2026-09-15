import { pieceCaptureLevel, pieceMoveLevel, pieceSelectLevel } from './audioMix';

export const pieceMoveCue = 'move-2';
export const pieceCaptureCue = 'crush-b';
export const pieceAhCue = 'ah';
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

export function pieceStepSfx(king: boolean, capture: boolean): void {
 if (capture) {
  cancelPieceAh();
  play(pieceCaptureCue, pieceCaptureLevel);
  ahTimer = setTimeout(() => {
   ahTimer = undefined;
   play(pieceAhCue, 1);
  }, pieceAhDelayMs);
  return;
 }
 if (!king) play(pieceMoveCue, pieceMoveLevel);
}

export function pieceSelectSfx(): void {
 play(pieceSelectCue, pieceSelectLevel);
}
