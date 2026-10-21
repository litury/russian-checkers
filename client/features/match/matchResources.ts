import Phaser from 'phaser';
import { loadImage } from '@/client/platform/browser/assetLoader';
import { warmImages } from '@/client/platform/browser/idleWork';
import { markPerf } from '@/client/platform/browser/perfMarks';
import { preloadKingFire } from './board/kingFireAssets';
import {
	type SelectionOverlayFrame,
	selectionOverlayTexture,
} from './board/selectionOverlay';
import { boardDelivery } from './boardDelivery';
import { preloadBunkerPanels } from './hud/bunkerPanel';
import { pieceSprites } from './layout';

interface ResourceOwner {
	isBuilt(): boolean;
	build(): void;
	warmAudio(): void;
	ready(): Promise<void>;
	isOver(): boolean;
}
export class MatchResources {
	failed = false;
	private disposed = false;
	private endpointWarmUp = false;
	private stopWarmUp?: () => void;
	private pendingLoads = new Set<() => void>();
	readonly missingDecoration = { selectionOverlay: false, kingFire: false };
	constructor(
		private scene: Phaser.Scene,
		private owner: ResourceOwner,
	) {}
	flushLoader(): Promise<void> {
		return new Promise((resolve) => {
			if (this.failed || this.disposed) {
				resolve();
				return;
			}
			if (!this.scene.load.isLoading() && this.scene.load.list.size === 0) {
				resolve();
				return;
			}
			const complete = () => {
				this.scene.load.off('complete', complete);
				this.pendingLoads.delete(complete);
				resolve();
			};
			this.pendingLoads.add(complete);
			this.scene.load.once('complete', complete);
			if (!this.scene.load.isLoading()) this.scene.load.start();
		});
	}

	async queueTitleCritical(): Promise<void> {
		const reliquaryAssets: Record<string, string> = {
			...import.meta.glob<string>(
				[
					'./board/reliquary/*.webp',
					'!./board/reliquary/black_disk.webp',
					'!./board/reliquary/ivory_disk.webp',
				],
				{ eager: true, query: '?url', import: 'default' },
			),
			'./board/reliquary/black_disk.webp': new URL(
				'../menu/assets/opening/black_disk.webp',
				import.meta.url,
			).href,
			'./board/reliquary/ivory_disk.webp': new URL(
				'../menu/assets/opening/ivory_disk.webp',
				import.meta.url,
			).href,
		};
		const aliases: Record<string, string> = {
			ivory_disk: pieceSprites.manLight,
			black_disk: pieceSprites.manDark,
			ivory_king: pieceSprites.kingLight,
			black_king: pieceSprites.kingDark,
		};
		let completed = 0;
		await Promise.all(
			Object.entries(reliquaryAssets).map(async ([path, url]) => {
				const name = path.slice(path.lastIndexOf('/') + 1).replace('.webp', '');
				const image = await loadImage(boardDelivery(name, url));

				if (this.failed || this.disposed) return;
				if (!this.scene.textures.exists(`reliquary_${name}`))
					this.scene.textures.addImage(`reliquary_${name}`, image);
				if (aliases[name] && !this.scene.textures.exists(aliases[name]))
					this.scene.textures.addImage(aliases[name], image);
				window.checkersStartup?.status(
					`Доска и шашки: ${++completed}/${Object.keys(reliquaryAssets).length}`,
				);
			}),
		);

		const tiers = import.meta.glob(
			'../menu/assets/siege/{white,black}-{base,moving,front}.webp',
			{ eager: true, query: '?url', import: 'default' },
		) as Record<string, string>;
		await Promise.all(
			Object.entries(tiers).map(async ([path, url]) => {
				const name = path.split('/').pop()?.replace('.webp', '');
				if (!name) return;
				try {
					const image = await loadImage(url);
					if (this.failed || this.disposed) return;
					if (!this.scene.textures.exists(`piece-tier-${name}`))
						this.scene.textures.addImage(`piece-tier-${name}`, image);
				} catch {
					return;
				}
			}),
		);
		this.scene.load.image(
			'marker_staples',
			new URL('./board/markers/staples.png', import.meta.url).href,
		);
		this.scene.load.image(
			'marker_staples_amber',
			new URL('./board/markers/staples-amber.png', import.meta.url).href,
		);
		this.scene.load.image(
			'marker_staples_copper',
			new URL('./board/markers/staples-copper.png', import.meta.url).href,
		);
		this.scene.load.image(
			'marker_arrow_amber',
			new URL('./board/markers/arrow-amber.png', import.meta.url).href,
		);
		this.scene.load.image(
			'marker_arrow_copper',
			new URL('./board/markers/arrow-copper.png', import.meta.url).href,
		);
		this.scene.load.image(
			'marker_cut',
			new URL('./board/markers/cut.png', import.meta.url).href,
		);
	}

	queueMatchInteractive(): void {
		this.scene.load.image(
			'selection_king-seal',
			new URL(
				'./board/selection/markers/king-seal-proposed.webp',
				import.meta.url,
			).href,
		);
	}

	warmSelectionEndpoints(): void {
		if (this.endpointWarmUp || this.failed) return;
		this.endpointWarmUp = true;
		const urls = Object.entries(
			import.meta.glob('./board/selection-v2/frames/*/*-{00,55}.webp', {
				query: '?url',
				import: 'default',
			}) as Record<string, () => Promise<string>>,
		).sort(([a], [b]) => a.localeCompare(b));
		void Promise.all(urls.map(([, load]) => load()))
			.then((resolved) => {
				this.stopWarmUp = warmImages(
					resolved,
					() => this.failed || this.owner.isOver(),
				);
			})
			.catch(() => {});
	}

	queueKingFire(): void {
		preloadKingFire(this.scene);
	}

	async bootPlayfield(): Promise<void> {
		if (this.failed || this.disposed) return;
		window.checkersStartup?.status('Загружаем доску и шашки…');

		try {
			await this.queueTitleCritical();
		} catch {
			this.failed = true;
			window.checkersStartup?.fail(
				'Не удалось загрузить доску. Проверьте соединение и повторите загрузку.',
			);
			return;
		}

		if (this.failed || this.disposed) return;
		window.checkersStartup?.status('Загрузка: маркеры и панели…');
		preloadBunkerPanels(this.scene);
		await this.flushLoader();
		if (this.failed || this.disposed) return;
		this.owner.build();
		if (!this.owner.isBuilt()) return;

		markPerf('playfield-ready');

		this.owner.warmAudio();
	}

	async bootMatchInteractive(): Promise<void> {
		if (this.failed || this.disposed) return;
		await this.owner.ready();
		if (this.failed || this.disposed || !this.owner.isBuilt()) return;
		window.checkersStartup?.status('Загрузка: подготовка взаимодействия…');
		this.queueMatchInteractive();
		await this.flushLoader();
		if (this.failed || this.disposed) return;
		for (const key of this.scene.textures.getTextureKeys()) {
			if (!key.startsWith('selection_')) continue;
			this.scene.textures
				.get(key)
				?.setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
	}

	async queueSelectionOverlay(): Promise<void> {
		const frames = import.meta.glob('./board/selection-overlay/*.png', {
			query: '?url',
			import: 'default',
		}) as Record<string, () => Promise<string>>;
		const entries = await Promise.all(
			Object.entries(frames).map(
				async ([path, load]) => [path, await load()] as const,
			),
		);
		for (const [path, url] of entries) {
			const frame = path
				.split('/')
				.pop()!
				.replace('.png', '')
				.replace('select_', '') as SelectionOverlayFrame;
			this.scene.load.image(selectionOverlayTexture(frame), url);
		}
	}

	async bootSelectionOverlay(): Promise<void> {
		if (this.failed || this.disposed || !this.owner.isBuilt()) return;
		await this.queueSelectionOverlay();
		await this.flushLoader();
		if (this.failed || this.disposed) return;
		for (const key of this.scene.textures.getTextureKeys()) {
			if (!key.startsWith('selection_overlay_')) continue;
			this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
	}

	async bootKingFire(): Promise<void> {
		if (this.failed || this.disposed || !this.owner.isBuilt()) return;
		this.queueKingFire();
		await this.flushLoader();
		if (this.failed || this.disposed) return;
		for (const key of this.scene.textures.getTextureKeys()) {
			if (!key.startsWith('king-fire_')) continue;
			this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
	}
	stopWarmup(): void {
		this.stopWarmUp?.();
		this.stopWarmUp = undefined;
	}
	dispose(): void {
		this.disposed = true;
		this.failed = true;
		this.stopWarmup();
		for (const complete of [...this.pendingLoads]) complete();
	}
}
