import Phaser from 'phaser';

const NODE = 'FilterGrassWind';

const frag = `
#pragma phaserTemplate(shaderName)

precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float uTime;

varying vec2 outTexCoord;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
	vec2 px = outTexCoord * resolution;
	vec4 base = texture2D(uMainSampler, outTexCoord);
	float sage = base.g - max(base.r, base.b);
	if (sage < 0.035) {
		gl_FragColor = base;
		return;
	}
	float epoch = floor(uTime * 0.55);
	vec2 jitter = vec2(hash(floor(px * 0.08)), hash(floor(px * 0.08) + 4.2));
	vec2 cell = floor(px / (16.0 + jitter.x * 10.0) + jitter * 0.7);
	float n = hash(cell + epoch * 17.0);
	float gust = sin(px.x * 0.009 - px.y * 0.006 - uTime * 0.35);
	float live = step(0.5, n + gust * 0.12);
	float dir = step(0.5, hash(cell + epoch * 3.0)) * 2.0 - 1.0;
	float wave = sin(uTime * 2.2 + hash(cell) * 6.28318);
	vec2 off = live * dir * wave * vec2(3.0, 2.0) / resolution;
	gl_FragColor = texture2D(uMainSampler, outTexCoord + off);
}
`;

export class GrassWindController extends Phaser.Filters.Controller {
	time = 0;

	constructor(camera: Phaser.Cameras.Scene2D.Camera) {
		super(camera, NODE);
	}
}

class FilterGrassWind extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
	constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
		super(NODE, manager, undefined, frag);
	}

	setupUniforms(
		controller: GrassWindController,
		drawingContext: { width: number; height: number },
	): void {
		this.programManager.setUniform('uTime', controller.time);
		this.programManager.setUniform('resolution', [
			drawingContext.width,
			drawingContext.height,
		]);
	}
}

export function attachGrassWind(
	scene: Phaser.Scene,
	ground: Phaser.GameObjects.TileSprite,
): GrassWindController | null {
	const renderer = scene.renderer;
	if (
		!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) ||
		!ground.enableFilters
	) {
		return null;
	}
	if (!renderer.renderNodes.hasNode(NODE)) {
		renderer.renderNodes.addNodeConstructor(NODE, FilterGrassWind);
	}
	ground.enableFilters();
	const controller = new GrassWindController(ground.filterCamera);
	ground.filters?.internal.add(controller);
	scene.events.on('update', (_: unknown, delta: number) => {
		if (!controller.active) {
			return;
		}
		controller.time += delta * 0.001;
	});
	return controller;
}
