import Phaser from 'phaser';
import { tableLayers } from '@/client/config/layout';

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
	vec2 px = outTexCoord * resolution;
	vec2 cell = floor(px / 18.0);
	float n = hash(cell);
	float live = step(0.42, n);
	float dir = step(0.5, hash(cell + 9.1)) * 2.0 - 1.0;
	float wave = sin(uTime * 2.4 + n * 6.28318);
	vec2 off = live * dir * wave * vec2(8.0, 5.0) / resolution;
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
		const loop = this.manager.renderer.game?.loop;
		const t = loop ? loop.time * 0.001 : controller.time;
		this.programManager.setUniform('uTime', t);
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
	if (typeof scene.time?.addEvent === 'function') {
		const ping = [0, 1, 2, 1] as const;
		let step = 0;
		scene.time.addEvent({
			delay: 480,
			loop: true,
			callback: () => {
				step = (step + 1) % ping.length;
				ground.setTexture(tableLayers.earthWind[ping[step]]);
			},
		});
	}
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
