import Phaser from 'phaser';

const NODE = 'FilterGrassWind';

const frag = `
#pragma phaserTemplate(shaderName)

precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float uTime;

varying vec2 outTexCoord;

#pragma phaserTemplate(fragmentHeader)

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
	vec4 base = texture2D(uMainSampler, outTexCoord);
	float sage = base.g - max(base.r, base.b);
	if (sage < 0.008) {
		gl_FragColor = base;
		return;
	}
	vec2 px = outTexCoord * resolution;
	float tuft = hash(floor(px * 0.35));
	float gust = sin(px.x * 0.012 - px.y * 0.008 - uTime * 1.15 + tuft * 6.28318);
	float blade = sin(uTime * 2.6 + tuft * 4.0 + px.y * 0.05);
	vec2 off = vec2(gust * 2.4 + blade * 1.1, blade * 0.9) / resolution;
	gl_FragColor = boundedSampler(uMainSampler, outTexCoord + off);
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
	if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
		return null;
	}
	if (typeof ground.enableFilters !== 'function') {
		return null;
	}
	if (!renderer.renderNodes.hasNode(NODE)) {
		renderer.renderNodes.addNodeConstructor(NODE, FilterGrassWind);
	}
	ground.enableFilters();
	const camera = ground.filterCamera;
	if (!camera || !ground.filters?.internal) {
		return null;
	}
	const controller = new GrassWindController(camera);
	controller.setPaddingOverride(null);
	controller.active = true;
	ground.filters.internal.add(controller);
	ground.renderFilters = true;
	scene.events.on('update', (_time: number, delta: number) => {
		if (!controller.active) {
			return;
		}
		controller.time += delta * 0.001;
	});
	return controller;
}
