import { pieceBarkLevel, pieceCaptureLevel, pieceMoveLevel, pieceSelectLevel } from './audioMix';

export const pieceMoveWhiteCue = 'move-w';
export const pieceMoveBlackCue = 'b-click';
export const pieceCaptureCue = 'crush-b';
export const pieceAhOrcCue = 'ah';
export const pieceAhElfCue = 'ah-elf';
export const pieceAhDelayMs = 100;
export const pieceSelectCue = 'select-b';
export const elfSelectBarks = ['lab-ibo', 'lab-est', 'lab-rabota', 'lab-boi'] as const;
export const orcSelectBarks = ['gob-ibo', 'gob-est', 'gob-rubi', 'gob-boi'] as const;
export const elfTaunts = ['elf-taunt-1', 'elf-taunt-2', 'elf-taunt-3'] as const;
export const orcTaunts = ['orc-taunt-1', 'orc-taunt-2', 'orc-taunt-3'] as const;
export const voiceStealSec = 0.05;

let play: (name: string, level?: number) => void = () => {};
let bark: (name: string, level?: number) => void = () => {};
let stopBark: () => void = () => {};
let ahTimer: ReturnType<typeof setTimeout> | undefined;

export function bindPieceSfx(next: typeof play): void {
 cancelPieceAh();
 play = next;
}

export function bindPieceVoice(next: typeof bark, cut: typeof stopBark = () => {}): void {
 bark = next;
 stopBark = cut;
}

export function stopSelectBark(): void {
 stopBark();
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
 stopSelectBark();
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

export function pickCue(cues: readonly string[]): string {
 return cues[Math.floor(Math.random() * cues.length)]!;
}

export function defeatTauntCue(humanSide: 'white' | 'black'): string {
 return pickCue(humanSide === 'white' ? orcTaunts : elfTaunts);
}

export function pieceSelectSfx(side: 'white' | 'black' = 'black'): void {
 play(pieceSelectCue, pieceSelectLevel);
 bark(pickCue(side === 'white' ? elfSelectBarks : orcSelectBarks), pieceBarkLevel);
}
