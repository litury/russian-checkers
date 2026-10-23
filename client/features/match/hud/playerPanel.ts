import Phaser from 'phaser';
import {
	readTextRole,
	readTextSpacing,
	type TextRole,
} from '@/client/fonts/typography';
import { panelDurationMs } from '@/client/platform/browser/panelReveal';
import type { Side } from '@/shared/rules';
import { pieceSprites } from '../layout';
import hudAtlas from './assets/gothic/atlas.json';
import hudAtlasUrl from './assets/gothic/atlas.webp?url';
import type { PanelState } from './panelState';
import { playerPanelGeometry } from './playerPanelGeometry';

export function preloadPlayerPanels(scene: Phaser.Scene) {
	scene.load.atlas('match-hud', hudAtlasUrl, hudAtlas);
}

export function createPlayerPanel(scene: Phaser.Scene, own: boolean) {
	const root = scene.add.container(0, 0).setDepth(12);
	const hasArt = scene.textures.exists('match-hud');
	const surface = (frame: string, horizontal: number, vertical: number) => {
		const art =
			hasArt && scene.textures.get('match-hud').has(frame)
				? scene.add
						.nineslice(
							0,
							0,
							'match-hud',
							frame,
							748,
							256,
							horizontal,
							horizontal,
							vertical,
							vertical,
						)
						.setOrigin(0)
				: scene.add
						.rectangle(0, 0, 1, 1, 0x171a18)
						.setStrokeStyle(1, 0x777365)
						.setOrigin(0);
		root.add(art);
		return art;
	};
	const panel = surface('panel', 40, 30);
	const clock = surface('clock-idle', 24, 18);
	const information = surface(own ? 'status-neutral' : 'identity', 28, 8);
	const typography = new Map<TextRole, ReturnType<typeof readTextRole>>();
	const roleStyle = (role: TextRole) => {
		let style = typography.get(role);
		if (!style) {
			style = readTextRole(role);
			typography.set(role, style);
		}
		return style;
	};
	const useRole = (label: Phaser.GameObjects.Text, role: TextRole) => {
		const style = roleStyle(role);
		label.setStyle(style).setLineSpacing(style.lineSpacing);
	};
	const text = (content: string, role: TextRole, color = '#eee4cf') => {
		const label = scene.add.text(0, 0, content, {
			...roleStyle(role),
			color,
			resolution: 2,
		});
		root.add(label);
		return label;
	};
	const name = own ? undefined : text('Компьютер', 'hud-name');
	const subtitle = own
		? undefined
		: text('Сложность: обычная', 'caption', '#c7bfad');
	const marker =
		!own && scene.textures.exists(pieceSprites.manDark)
			? scene.add.image(0, 0, pieceSprites.manDark).setOrigin(0.5)
			: undefined;
	if (marker) root.add(marker);
	const digits = Array.from({ length: 5 }, (_, index) =>
		text('00:00'[index], 'clock').setOrigin(0, 0.5),
	);
	const title = own ? text('Подготовка партии', 'hud-status') : undefined;
	const detail = own ? text('', 'caption', '#c7bfad') : undefined;
	const textObjects = [...digits, name, subtitle, title, detail].filter(
		(label): label is Phaser.GameObjects.Text => label !== undefined,
	);
	const smoothText = () => {
		for (const label of textObjects)
			label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
	};
	let state: PanelState = {
		kind: 'preparing',
		title: 'Подготовка партии',
		compactTitle: 'Подготовка',
		detail: '',
		tone: 'neutral',
	};
	let width = 374;
	let height = 128;
	let scaleX = 1;
	let scaleY = 1;
	let playerName = 'Компьютер';
	let playerDetail = 'Сложность: обычная';
	let clockValue = '00:00';
	let active = false;
	let preparing = false;
	let disposed = false;
	const placeSurface = (
		art: typeof panel,
		box: { x: number; y: number; width: number; height: number },
		pixelScale = 0.5,
	) => {
		art.setPosition(box.x / scaleX, box.y / scaleY);
		art.setSize(box.width / pixelScale, box.height / pixelScale);
		art.setScale(pixelScale / scaleX, pixelScale / scaleY);
	};
	const placeText = (
		label: Phaser.GameObjects.Text,
		left: number,
		top: number,
	) => {
		label
			.setPosition(left / scaleX, top / scaleY)
			.setScale(1 / scaleX, 1 / scaleY);
	};
	const frame = (art: typeof panel, name: string) => {
		if (
			hasArt &&
			'setFrame' in art &&
			scene.textures.get('match-hud').has(name)
		)
			art.setFrame(name);
	};
	const paintState = () => {
		const finished = state.kind === 'finished';
		const quiet =
			finished || state.kind === 'paused' || state.kind === 'waiting';
		const critical =
			!quiet &&
			!preparing &&
			clockValue !== '00:00' &&
			/^00:0\d$/.test(clockValue);
		frame(
			clock,
			`clock-${critical ? 'critical' : active && !preparing && !quiet ? 'active' : 'idle'}`,
		);
		clock.setAlpha(finished ? 0.6 : 1);
		for (const digit of digits)
			digit.setColor(
				finished
					? '#bdb5a5'
					: critical
						? '#edb4a1'
						: active && !preparing && !quiet
							? '#f2dfb5'
							: '#eee4cf',
			);
		if (own)
			frame(
				information,
				`status-${state.tone === 'active' || state.tone === 'win' ? 'active' : state.tone === 'warning' || state.tone === 'loss' ? 'warning' : 'neutral'}`,
			);
		smoothText();
	};
	const layoutContent = () => {
		const geometry = playerPanelGeometry(width, height);
		const compact = geometry.compact;
		const spacing = readTextSpacing();
		const inset = compact ? spacing.compactInset : spacing.inset;
		placeSurface(panel, { x: 0, y: 0, width, height });
		placeSurface(clock, geometry.clock, compact ? 0.25 : 0.5);
		placeSurface(
			information,
			own ? geometry.status : geometry.identity,
			compact ? 0.25 : 0.5,
		);
		const clockRole = compact ? 'clock-compact' : 'clock';
		const fontSize = roleStyle(clockRole).fontSize;
		const digitAdvance = fontSize * 0.66;
		const colonAdvance = fontSize * 0.32;
		const clockCenter = geometry.clock.x + geometry.clock.width / 2;
		const digitLeft = clockCenter - (digitAdvance * 4 + colonAdvance) / 2;
		const offsets = [
			0,
			digitAdvance,
			digitAdvance * 2,
			digitAdvance * 2 + colonAdvance,
			digitAdvance * 3 + colonAdvance,
		];
		digits.forEach((digit, index) => {
			useRole(digit, clockRole);
			placeText(
				digit,
				digitLeft + offsets[index],
				geometry.clock.y + geometry.clock.height / 2,
			);
		});
		if (name && subtitle) {
			const box = geometry.identity;
			useRole(name, compact ? 'hud-name-compact' : 'hud-name');
			name.setText(playerName);
			const nameInset = marker ? 34 : 16;
			const available = box.width - nameInset - 16;
			const characters = Array.from(playerName);
			while (name.width > available && characters.length > 1) {
				characters.pop();
				name.setText(`${characters.join('')}…`);
			}
			useRole(subtitle, 'caption');
			subtitle.setText(playerDetail).setWordWrapWidth(box.width - 32, true);
			const showSubtitle =
				playerDetail !== '' &&
				name.height + subtitle.height + spacing.gap <= box.height - inset * 2;
			subtitle.setVisible(showSubtitle);
			const groupHeight =
				name.height + (showSubtitle ? subtitle.height + spacing.gap : 0);
			const top = box.y + (box.height - groupHeight) / 2;
			placeText(name, box.x + nameInset, top);
			if (showSubtitle)
				placeText(subtitle, box.x + 16, top + name.height + spacing.gap);
			if (marker) {
				marker.setPosition(
					(box.x + 20) / scaleX,
					(top + name.height / 2) / scaleY,
				);
				marker.setDisplaySize(16 / scaleX, 16 / scaleY);
			}
		}
		if (title && detail) {
			const box = geometry.status;
			const finished = state.kind === 'finished';
			const padding = compact ? 7 : 12;
			const available = box.width - padding * 2;
			useRole(
				title,
				finished
					? compact
						? 'hud-result-compact'
						: 'hud-result'
					: compact
						? 'hud-status-compact'
						: box.width < 180
							? 'label'
							: 'hud-status',
			);
			title.setText(compact ? state.compactTitle : state.title);
			if (finished && title.height > box.height - inset * 2)
				useRole(title, 'hud-result-compact');
			if (title.width > available) title.setText(state.compactTitle);
			useRole(detail, 'caption');
			detail.setText(state.detail).setWordWrapWidth(available, true);
			const showDetail =
				!compact &&
				state.detail !== '' &&
				title.height + detail.height + spacing.gap <= box.height - inset * 2;
			detail.setVisible(showDetail);
			const textHeight =
				title.height + (showDetail ? detail.height + spacing.gap : 0);
			placeText(title, box.x + padding, box.y + (box.height - textHeight) / 2);
			if (showDetail)
				placeText(
					detail,
					box.x + padding,
					box.y + (box.height - textHeight) / 2 + title.height + spacing.gap,
				);
			title.setColor(
				state.tone === 'loss' || state.tone === 'warning'
					? '#ecc0af'
					: state.tone === 'active' || state.tone === 'win'
						? '#ecd6ae'
						: '#eee4cf',
			);
		}
		smoothText();
	};
	void Promise.all(
		(['hud-name', 'caption', 'clock'] as const).map((role) => {
			const style = roleStyle(role);
			return document.fonts?.load(
				`${style.fontStyle} ${style.fontSize}px ${style.fontFamily}`,
			);
		}),
	)
		.then(() => {
			if (disposed) return;
			layoutContent();
		})
		.catch(() => {});
	scene.events.once('shutdown', () => {
		disposed = true;
	});
	layoutContent();
	return {
		root,
		layout(
			left: number,
			top: number,
			horizontal: number,
			vertical = horizontal,
		) {
			scaleX = horizontal;
			scaleY = vertical;
			width = 374 * horizontal;
			height = 128 * vertical;
			root.setPosition(left, top).setScale(horizontal, vertical);
			layoutContent();
		},
		pose(elapsed: number, reduced: boolean) {
			const progress = Math.min(1, Math.max(0, elapsed) / panelDurationMs);
			root.setAlpha(reduced ? 1 : 0.9 + 0.1 * (1 - (1 - progress) ** 3));
		},
		setIdentity(value: string, description: string) {
			if (playerName === value && playerDetail === description) return;
			playerName = value;
			playerDetail = description;
			layoutContent();
		},
		setSide(side: Side) {
			marker?.setTexture(
				side === 'white' ? pieceSprites.manLight : pieceSprites.manDark,
			);
			layoutContent();
		},
		setClock(value: string, isActive: boolean, isPreparing: boolean) {
			if (
				value === clockValue &&
				active === isActive &&
				preparing === isPreparing
			)
				return;
			clockValue = value;
			active = isActive;
			preparing = isPreparing;
			digits.forEach((digit, index) => {
				digit.setText(value[index] ?? '0');
			});
			paintState();
		},
		setState(value: PanelState) {
			if (
				state.kind === value.kind &&
				state.title === value.title &&
				state.compactTitle === value.compactTitle &&
				state.detail === value.detail &&
				state.tone === value.tone
			)
				return;
			state = value;
			paintState();
			layoutContent();
		},
	};
}
