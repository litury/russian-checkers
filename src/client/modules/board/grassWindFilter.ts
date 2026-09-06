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
	float t = floor(uTime * 3.5) * 0.28;
	vec2 cell = floor(px / 18.0);
	float n = hash(cell + floor(t));
	float gust = sin(px.x * 0.011 - px.y * 0.007 - t * 0.9);
	float live = step(0.55, n + gust * 0.18);
	float dir = step(0.5, hash(cell + 9.1)) * 2.0 - 1.0;
	vec2 off = live * dir * vec2(2.0, 1.0) / resolution;
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
