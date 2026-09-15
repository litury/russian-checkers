export const kingFireIgniteCue = 'ignite-a';
export const kingFireTrailCue = 'trail-b';

let play: (name: string, level?: number) => void = () => {};

export function bindKingFireSfx(next: typeof play): void {
 play = next;
}

export function kingFireIgniteSfx(reduced = false): void {
 if (!reduced) play(kingFireIgniteCue, 1);
}

export function kingFireTrailSfx(king: boolean, reduced = false): void {
 if (king && !reduced) play(kingFireTrailCue, .9);
}
