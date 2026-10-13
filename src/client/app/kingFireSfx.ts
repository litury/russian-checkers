import { kingPromotionLevel } from './audioMix';

export const kingFireIgniteCue = 'ignite-a';
export const kingFireTrailCue = 'trail-b';

let play: (name: string, level?: number) => void = () => {};

export function bindKingFireSfx(next: typeof play): void {
 play = next;
}

export function kingFireIgniteSfx(reduced = false): void {
 // Reduced motion still acknowledges the accepted promotion.
 void reduced;
 play(kingFireIgniteCue, kingPromotionLevel);
}

export function kingFireTrailSfx(king: boolean, reduced = false): void {
 if (king && !reduced) play(kingFireTrailCue, .9);
}
