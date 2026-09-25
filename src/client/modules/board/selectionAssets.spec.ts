import { expect, it } from 'vitest';
import scene from '@/client/app/gameScene.ts?raw';
import idleWork from '@/client/app/idleWork.ts?raw';

const frames = import.meta.glob('./selection-v2/frames/*/*.webp', {
	eager: true,
	query: '?url',
	import: 'default',
});
const seals = import.meta.glob('./selection/markers/*.webp', {
	eager: true,
	query: '?url',
	import: 'default',
});
const overlay = import.meta.glob('./selection-overlay/*.png', {
	eager: true,
	query: '?url',
	import: 'default',
});
it('delivers112 v2 WebP frames and preserves the separate king seal', () => {
	expect(Object.keys(frames)).toHaveLength(112);
	for (const side of ['white', 'black'])
		for (let i = 0; i <= 55; i++)
			expect(
				frames[
					`./selection-v2/frames/${side}/${side}-${String(i).padStart(2, '0')}.webp`
				],
			).toBeTruthy();
	expect(Object.keys(seals)).toHaveLength(1);
	expect(scene).toContain("this.load.image('selection_king-seal'");
});
it('keeps the 112-frame pack out of the Phaser match pack', () => {
	// The board draws Reliquary disks and markers/*.png brackets; the frames are
	// menu/result art. Nothing may queue the whole 7.9 MB pack into the scene loader.
	expect(scene).not.toMatch(/this\.load\.image\(`selection_/);
	expect(scene).not.toMatch(/frames\/\*\/\*\.webp[\s\S]{0,120}eager:\s*true/);
	const matchInteractive =
		scene.match(
			/private queueMatchInteractive\(\): void \{[\s\S]*?\n\t\}/,
		)?.[0] ?? '';
	expect(matchInteractive).toContain('selection_king-seal');
	expect(matchInteractive).not.toContain('import.meta.glob');
});
it('warms only endpoint frames, in idle time, after input is already allowed', () => {
	// Endpoints are what the menu and the result window show (00/55 per side).
	expect(scene).toContain('selection-v2/frames/*/*-{00,55}.webp');
	const warm =
		scene.match(
			/private warmSelectionEndpoints\(\): void \{[\s\S]*?\n\t\}/,
		)?.[0] ?? '';
	expect(warm).toContain('warmImages');
	expect(warm).not.toContain('eager: true');
	// The reveal path must not touch it: it is scheduled only when input is free.
	const startMatch =
		scene.match(/private async startMatch\([\s\S]*?\n\t\}/)?.[0] ?? '';
	expect(startMatch).not.toContain('warmSelectionEndpoints');
	const refresh =
		scene.match(/private refresh\(\): void \{[\s\S]*?\n\t\}/)?.[0] ?? '';
	expect(refresh).toContain('this.canSelect()');
	expect(refresh.indexOf('this.canSelect()')).toBeLessThan(
		refresh.indexOf('warmSelectionEndpoints'),
	);
	// Idle scheduling itself yields when the browser has no requestIdleCallback.
	expect(idleWork).toContain('requestIdleCallback');
	expect(idleWork).toContain('setTimeout');
});
it('delivers the ten overlay frames and queues them only after the reveal', () => {
	const names = [
		'select_none',
		'select_enter-01',
		'select_enter-02',
		'select_enter-03',
		'select_enter-04',
		'select_hold-01',
		'select_hold-02',
		'select_exit-01',
		'select_exit-02',
		'select_exit-03',
	];
	expect(Object.keys(overlay).sort()).toEqual(
		names.map((name) => `./selection-overlay/${name}.png`).sort(),
	);
	expect(scene).toContain('../modules/board/selection-overlay/*.png');
	const queue =
		scene.match(
			/private async queueSelectionOverlay\(\): Promise<void> \{[\s\S]*?\n	\}/,
		)?.[0] ?? '';
	expect(queue).toContain("replace('select_', '')");
	expect(queue).toContain('selectionOverlayTexture(frame)');
	const boot =
		scene.match(
			/private async bootSelectionOverlay\(\): Promise<void> \{[\s\S]*?\n	\}/,
		)?.[0] ?? '';
	expect(boot).toContain('await this.queueSelectionOverlay()');
	expect(boot).toContain('await this.flushLoader()');
	// Neither start gate may own the decoration pack.
	for (const gate of [
		/bootPlayfield\(\): Promise<void> \{[\s\S]*?\n	\}/,
		/bootMatchInteractive\(\): Promise<void> \{[\s\S]*?\n	\}/,
	])
		expect(scene.match(gate)?.[0] ?? '').not.toContain('queueSelectionOverlay');
	// The lazy pack is warmed through the isolated optional step, never bare-await:
	// a rejected URL import must not cancel king-fire nor leak an unhandled rejection.
	expect(scene).toContain("optionalPack(\n				'selection-overlay',");
	expect(scene).toContain('() => this.bootSelectionOverlay(),');
	expect(scene).not.toContain('await this.bootSelectionOverlay()');
});
