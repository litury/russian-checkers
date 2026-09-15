import { pieceCaptureLevel, pieceMoveLevel } from './audioMix';

export const pieceMoveCue = 'move-b';
export const pieceCaptureCue = 'capture';

let play: (name: string, level?: number) => void = () => {};

export function bindPieceSfx(next: typeof play): void {
 play = next;
}

export function pieceStepSfx(king: boolean, capture: boolean): void {
 if (capture) play(pieceCaptureCue, pieceCaptureLevel);
 else if (!king) play(pieceMoveCue, pieceMoveLevel);
}
