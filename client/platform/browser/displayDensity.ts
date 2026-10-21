import type Phaser from 'phaser';

type Dimensions = ReturnType<typeof densityDimensions>;

/** Install once per scene lifetime, including restart cleanup. Canvas fallback stays at 1x. */
export function installDisplayDensity(
	scene: Phaser.Scene,
	layout: (width: number, height: number) => void,
): void {
	const canvas = scene.game.canvas;
	const parent = canvas.parentElement;
	if (!parent) return;
	const gl = (scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
	const limit = gl
		? Math.min(
				gl.getParameter(gl.MAX_TEXTURE_SIZE),
				gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
			)
		: Infinity;
	const oldRendering = canvas.style.imageRendering;
	canvas.style.imageRendering = 'auto';
	let media: MediaQueryList | undefined;
	let stopped = false;
	let observedDpr = window.devicePixelRatio;
	const update = () => {
		if (stopped || !parent.clientWidth || !parent.clientHeight) return;
		observedDpr = window.devicePixelRatio;
		if (
			applyDisplayDensity(
				scene,
				parent.clientWidth,
				parent.clientHeight,
				gl ? window.devicePixelRatio : 1,
				limit,
			)
		) {
			const size = logicalSize(scene);
			layout(size.width, size.height);
		}
	};
	const onDpr = () => {
		update();
		watchDpr();
	};
	const watchDpr = () => {
		media?.removeEventListener('change', onDpr);
		media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		media.addEventListener('change', onDpr);
	};
	const observer = new ResizeObserver(update);
	// Some browsers/CDP change DPR without a resize or media-query event.
	// Only compare one number per frame; do not measure layout unless it changes.
	const checkDpr = () => {
		if (window.devicePixelRatio !== observedDpr) update();
	};
	scene.events.on('preupdate', checkDpr);
	observer.observe(parent);
	window.addEventListener('resize', update);
	watchDpr();
	update();
	scene.events.once('shutdown', () => {
		stopped = true;
		scene.events.off('preupdate', checkDpr);
		observer.disconnect();
		window.removeEventListener('resize', update);
		media?.removeEventListener('change', onDpr);
		dimensions.delete(scene.scale);
		canvas.style.imageRendering = oldRendering;
	});
}

const dimensions = new WeakMap<Phaser.Scale.ScaleManager, Dimensions>();

export function densityDimensions(
	width: number,
	height: number,
	dpr: number,
	limit = Infinity,
) {
	width = Math.max(1, Math.round(width));
	height = Math.max(1, Math.round(height));
	let density = Number.isFinite(dpr) ? Math.min(2, Math.max(1, dpr)) : 1;
	if (Math.max(width, height) * density > limit) density = 1;
	return {
		width,
		height,
		density,
		backingWidth: Math.round(width * density),
		backingHeight: Math.round(height * density),
	};
}

/** Layout/DOM use CSS pixels; Phaser ScaleManager and pointer coordinates use backing pixels. */
export function logicalSize(scene: Pick<Phaser.Scene, 'scale'>) {
	const d = dimensions.get(scene.scale);
	return {
		width: d?.width ?? scene.scale.width,
		height: d?.height ?? scene.scale.height,
	};
}

/** Public NONE + setZoom + resize path. ScaleManager owns canvas, renderer and input displayScale. */
export function applyDisplayDensity(
	scene: Phaser.Scene,
	width: number,
	height: number,
	dpr: number,
	limit = Infinity,
): boolean {
	const next = densityDimensions(width, height, dpr, limit);
	const previous = dimensions.get(scene.scale);
	if (
		previous &&
		Object.keys(next).every(
			(k) => next[k as keyof Dimensions] === previous[k as keyof Dimensions],
		)
	)
		return false;
	dimensions.set(scene.scale, next);
	// resize() skips CSS writes at zoom=1 in Phaser 4.2.1. Apply zoom AFTER
	// the new backing size so its refresh writes current CSS dimensions even at 1x.
	scene.scale.resize(next.backingWidth, next.backingHeight);
	scene.scale.setZoom(1 / next.density);
	// Absolute, never multiplicative. Camera inverse maps backing-space pointer hits back to logical objects.
	scene.cameras.main
		.setViewport(0, 0, next.backingWidth, next.backingHeight)
		.setOrigin(0, 0)
		.setZoom(next.density)
		.setScroll(0, 0);
	return true;
}
