import './matchHistory.css';
import '../rules/rules.css';
import {
	buildHistoryReplay,
	incompleteReplayCopy,
	outcomeLabel,
} from '@/client/features/profile/historyReplay';
import { loadMatch, loadMatches } from '@/client/platform/network/cloud';
import { canOpenBoard, type MatchRow } from '@/shared/protocol/matchHistory';
import { squareAlg } from '@/shared/protocol/notation';
import type { Side } from '@/shared/rules';
import { uiSfx } from '../../audio/uiSfx';
import blackArt from '../match/board/reliquary/black_disk.webp';
import blackKingArt from '../match/board/reliquary/black_king.webp';
import boardArt from '../match/board/reliquary/board-frames.webp';
import whiteArt from '../match/board/reliquary/ivory_disk.webp';
import whiteKingArt from '../match/board/reliquary/ivory_king.webp';
import { bindProfileNavigation, type ProfilePage } from './profileNavigation';
import { bindProfileOverview } from './profileOverview';

const dateLabel = (value: string) => {
	const date = new Date(value);
	return Number.isFinite(date.getTime())
		? date.toLocaleString('ru-RU', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			})
		: 'Дата не указана';
};
const opponent = (row: MatchRow) =>
	row.mode === 'bot' ? 'Компьютер' : 'Соперник онлайн';
const sideLabel = (row: MatchRow) =>
	row.color === 'white' ? 'Вы — белые' : 'Вы — чёрные';
const element = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text = '',
) => {
	const node = document.createElement(tag);
	node.className = className;
	node.textContent = text;
	return node;
};

export function bindMatchHistory() {
	const open = document.getElementById('opening-history');
	const root = document.getElementById(
		'match-history',
	) as HTMLDialogElement | null;
	if (!open || !root || root.dataset.bound) return;
	root.dataset.bound = 'true';
	const el = <T extends HTMLElement = HTMLElement>(id: string) =>
		document.getElementById(id) as T;
	const heading = el('match-history-title');
	const overview = bindProfileOverview();
	let pane: ProfilePage = 'root';
	const showPane = (next: typeof pane) => {
		pane = next;
		el('match-history-profile').hidden = next !== 'root';
		el('profile-account-pane').hidden = next !== 'account';
		el('profile-history-pane').hidden = next !== 'list' && next !== 'record';
		el('profile-settings-pane').hidden = next !== 'settings';
		el('profile-rules-pane').hidden = next !== 'rules';
		heading.textContent = {
			root: 'Профиль',
			account: 'Аккаунт',
			list: 'История партий',
			record: 'Просмотр партии',
			settings: 'Настройки',
			rules: 'Правила игры',
		}[next];
	};
	const rules = el<HTMLButtonElement>('profile-rules');
	rules.addEventListener('click', () => {
		uiSfx('ui-open');
		(
			window as Window & { checkersRules?: { open: () => void } }
		).checkersRules?.open();
	});
	const scroll = el('match-history-scroll');
	const archive = el('match-history-archive');
	const list = el('match-history-list');
	const state = el('match-history-state');
	const stateTitle = el('match-history-state-title');
	const retry = el<HTMLButtonElement>('match-history-retry');
	const boardWrap = el('match-history-board');
	const board = el('match-history-grid');
	const filter = el<HTMLSelectElement>('match-history-filter');
	const notation = el('match-history-notation');
	const first = el<HTMLButtonElement>('mh-first');
	const prev = el<HTMLButtonElement>('mh-prev');
	const next = el<HTMLButtonElement>('mh-next');
	const end = el<HTMLButtonElement>('mh-end');
	// Decoration never gates data or controls. Fixed geometry also serves the CSS fallback.
	let boardArtLoading: Promise<boolean> | null = null;
	const loadBoardArt = () => {
		boardArtLoading ??= Promise.all(
			[boardArt, whiteArt, blackArt, whiteKingArt, blackKingArt].map(
				(src) =>
					new Promise<boolean>((resolve) => {
						const image = new Image();
						image.onload = () => {
							void image.decode().then(
								() => resolve(true),
								() => resolve(false),
							);
						};
						image.onerror = () => resolve(false);
						image.src = src;
					}),
			),
		).then((results) => results.every(Boolean));
		void boardArtLoading.then((ready) => {
			const frame = board.parentElement;
			if (frame) frame.dataset.art = ready ? 'ready' : 'fallback';
			el('match-history-art-status').textContent = ready
				? ''
				: 'Упрощённая доска: изображения недоступны. Дамки отмечены буквой Д.';
		});
	};
	let rows: MatchRow[] = [];
	let selected: MatchRow | null = null;
	let replay: ReturnType<typeof buildHistoryReplay> | null = null;
	let ply = 0,
		generation = 0,
		savedScroll = 0;
	let returnFocus: HTMLElement | null = null;
	let retryAction = () => {
		void fetchList();
	};
	let archiveState: 'loading' | 'error' | 'empty' | 'list' = 'loading';
	const focusHeading = () => heading.focus({ preventScroll: true });
	const showState = (label: string, copy: string, action?: () => void) => {
		state.hidden = false;
		stateTitle.textContent = label;
		el('match-history-state-copy').textContent = copy;
		retry.hidden = !action;
		if (action) retryAction = action;
	};
	const paintList = () => {
		list.replaceChildren();
		const visible = rows.filter(
			(row) => filter.value === 'all' || row.mode === filter.value,
		);
		el('match-history-summary').textContent = 'Сначала новые';
		for (const row of visible) {
			const item = element('article', 'mh-row');
			const outcome = element('div', 'mh-outcome', outcomeLabel(row));
			outcome.dataset.outcome =
				row.winner === null
					? 'unknown'
					: row.winner === 'draw'
						? 'draw'
						: row.winner === row.color
							? 'win'
							: 'loss';
			const info = element('div', 'mh-row-info');
			const name = element('h3', '', opponent(row));
			const date = element('time', '', dateLabel(row.startedAt));
			if (Number.isFinite(Date.parse(row.startedAt)))
				date.dateTime = row.startedAt;
			info.append(name, date);
			const detail = element(
				'p',
				'mh-row-detail',
				`${sideLabel(row)} · ${row.timeControl ?? '1+0'}`,
			);
			const action = element('div', 'mh-row-action');
			if (canOpenBoard(row)) {
				const button = element(
					'button',
					'mh-button metal-button secondary',
					'Смотреть',
				);
				button.type = 'button';
				button.setAttribute(
					'aria-label',
					`Смотреть: ${outcomeLabel(row)}, ${opponent(row)}, ${dateLabel(row.startedAt)}`,
				);
				button.addEventListener('click', () => {
					uiSfx('ui-tap');
					savedScroll = scroll.scrollTop;
					returnFocus = button;
					navigation.open('record', row);
				});
				action.append(button);
			} else action.append(element('span', 'mh-muted', 'Ходы не записаны'));
			item.append(outcome, info, detail, action);
			list.append(item);
		}
	};
	const restoreList = () => {
		uiSfx('ui-close');
		generation++;
		selected = null;
		replay = null;
		showPane('list');
		boardWrap.hidden = true;
		archive.hidden = archiveState !== 'list';
		state.hidden = archiveState === 'list';
		if (archiveState === 'error')
			showState(
				'Не удалось загрузить партии',
				'Проверьте соединение и попробуйте ещё раз.',
				() => {
					void fetchList();
				},
			);
		else if (archiveState === 'empty')
			showState('Пока нет партий', 'Здесь появятся сыгранные партии.');
		else if (archiveState === 'loading') {
			void fetchList();
		}
		scroll.scrollTop = savedScroll;
		if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
		else focusHeading();
	};
	const close = () => {
		generation++;
		uiSfx('ui-close');
		open.focus({ preventScroll: true });
	};
	async function fetchList() {
		const ticket = ++generation;
		archiveState = 'loading';
		archive.hidden = true;
		boardWrap.hidden = true;
		showState('Загрузка…', 'Получаем записанные партии.');
		const result = await loadMatches();
		if (ticket !== generation || !root?.open) return;
		if (result === null) {
			archiveState = 'error';
			showState(
				'Не удалось загрузить партии',
				'Проверьте соединение и попробуйте ещё раз.',
				() => {
					void fetchList();
				},
			);
		} else {
			rows = result
				.slice()
				.sort(
					(a, b) =>
						(Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0),
				);
			archiveState = rows.length ? 'list' : 'empty';
			const bothModes = new Set(rows.map((row) => row.mode)).size > 1;
			el('match-history-filter-label').hidden = !bothModes;
			if (!bothModes) filter.value = 'all';
			el('match-history-limit').hidden = rows.length < 50;
			if (!rows.length)
				showState('Пока нет партий', 'Здесь появятся сыгранные партии.');
			else {
				state.hidden = true;
				archive.hidden = false;
				paintList();
			}
		}
	}
	const paintPosition = (n: number) => {
		if (!replay) return;
		ply = Math.max(0, Math.min(n, replay.plies.length));
		const position = replay.positions[ply];
		board.replaceChildren();
		const description: string[] = [];
		const last = replay.plies[ply - 1];
		const facing: Side = selected?.color === 'black' ? 'black' : 'white';
		const frame = board.parentElement;
		if (frame) frame.dataset.facing = facing;
		const rows =
			facing === 'black' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
		for (const row of rows) {
			for (let col = 0; col < 8; col++) {
				const square = squareAlg({ row, col });
				const cell = element('i', 'mh-cell');
				cell.dataset.square = square;
				if ((row + col) % 2 === 0) cell.dataset.dark = '';
				const piece = position.squares[row][col];
				if (piece) {
					cell.dataset.side = piece.side;
					cell.dataset.kind = piece.kind;
					const fallback = element(
						'span',
						'mh-fallback-piece',
						piece.kind === 'king' ? 'Д' : '',
					);
					fallback.setAttribute('aria-hidden', 'true');
					cell.append(fallback);
					description.push(
						`${square}: ${piece.side === 'white' ? 'белая' : 'чёрная'} ${piece.kind === 'king' ? 'дамка' : 'шашка'}`,
					);
				}
				if (last && (last.from === square || last.path.at(-1) === square))
					cell.classList.add('mh-last');
				board.append(cell);
			}
		}
		board.setAttribute(
			'aria-label',
			`Полуход ${ply}. ${description.join('; ')}`,
		);
		first.disabled = prev.disabled = ply === 0;
		next.disabled = end.disabled = ply === replay.plies.length;
		const current = ply
			? `Ход ${Math.ceil(ply / 2)} · ${last.side === 'white' ? 'Белые' : 'Чёрные'} · ${replay.notation[ply - 1]}`
			: 'Начальная позиция · Ход белых';
		el('match-history-ply').replaceChildren(
			element('span', '', current),
			element(
				'span',
				'mh-muted',
				`${ply} из ${replay.plies.length} ходов сторон`,
			),
		);
		notation.querySelectorAll('button').forEach((button, i) => {
			if (i + 1 === ply) button.setAttribute('aria-current', 'step');
			else button.removeAttribute('aria-current');
		});
		const active = notation.querySelector<HTMLElement>('[aria-current]');
		if (!active) notation.scrollTop = 0;
		else {
			// offsetTop is relative to the positioned notation itself; subtracting notation.offsetTop scrolled to the wrong ply.
			const top =
				active.getBoundingClientRect().top -
				notation.getBoundingClientRect().top +
				notation.scrollTop;
			notation.scrollTop = Math.max(
				0,
				top - (notation.clientHeight - active.offsetHeight) / 2,
			);
		}
	};
	async function openMatch(row: MatchRow) {
		selected = row;
		replay = null;
		const ticket = ++generation;
		showPane('record');
		archive.hidden = true;
		boardWrap.hidden = true;
		scroll.scrollTop = 0;
		focusHeading();
		showState(
			'Загрузка записи…',
			`${opponent(row)} · ${dateLabel(row.startedAt)}`,
		);
		const result = await loadMatch(row.id);
		if (ticket !== generation || !root?.open) return;
		if (result.status === 'error') {
			showState(
				'Не удалось загрузить запись',
				'Проверьте соединение и попробуйте ещё раз.',
				() => {
					void openMatch(row);
				},
			);
			return;
		}
		if (result.status === 'missing') {
			showState(
				'Запись недоступна',
				'Партия не найдена или недоступна этому профилю. Вернитесь к списку.',
			);
			return;
		}
		const detail = result.detail;
		if (!detail.pliesList.length) {
			showState(
				'Ходы не записаны',
				'Партия есть в истории, но запись её ходов пуста.',
			);
			return;
		}
		replay = buildHistoryReplay(
			detail.pliesList,
			Math.max(detail.plies, row.plies),
		);
		replay.incomplete ||= detail.plies !== detail.pliesList.length;
		if (!replay.plies.length) {
			showState(
				'Запись повреждена',
				'Первый ход не удаётся воспроизвести. Позиции не восстановлены.',
			);
			return;
		}
		el('match-history-result').textContent = outcomeLabel(detail);
		el('match-history-meta').textContent =
			`${opponent(detail)} · ${sideLabel(detail)} · ${detail.timeControl ?? '1+0'} · ${dateLabel(detail.startedAt)}`;
		const warning = el('match-history-warning');
		warning.hidden = !replay.incomplete && detail.winner !== null;
		warning.textContent = replay.incomplete
			? incompleteReplayCopy(replay.plies.length)
			: 'Результат не записан. Показаны только сохранённые ходы.';
		notation.replaceChildren();
		replay.notation.forEach((move, i) => {
			const button = element(
				'button',
				'mh-move',
				`${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${move}`,
			);
			button.type = 'button';
			button.setAttribute('aria-label', `Полуход ${i + 1}: ${move}`);
			button.addEventListener('click', () => {
				if (ply !== i + 1) uiSfx('ui-tap');
				paintPosition(i + 1);
			});
			notation.append(button);
		});
		state.hidden = true;
		boardWrap.hidden = false;
		paintPosition(0);
		el('match-history-art-status').textContent =
			board.parentElement?.dataset.art === 'ready'
				? ''
				: 'Упрощённая доска: оформление загружается. Дамки отмечены буквой Д.';
		loadBoardArt();
	}
	const navigation = bindProfileNavigation({
		show: (page, record, returning) => {
			const previous = pane;
			generation++;
			selected = null;
			replay = null;
			showPane(page);
			scroll.scrollTop = 0;
			focusHeading();
			if (page === 'root') {
				void overview.refresh();
				if (returning && previous !== 'root') {
					const trigger = {
						account: 'profile-account',
						list: 'profile-history',
						record: 'profile-history',
						settings: 'opening-options',
						rules: 'profile-rules',
					}[previous];
					el(trigger).focus({ preventScroll: true });
				}
			} else if (page === 'list') {
				if (returning) restoreList();
				else void fetchList();
			} else if (page === 'record' && record) void openMatch(record);
		},
		close,
	});
	open.addEventListener('click', () => {
		if (root.open) return;
		returnFocus = null;
		savedScroll = 0;
		filter.value = 'all';
		navigation.open();
		uiSfx('ui-open');
	});
	el('profile-history').addEventListener('click', () => {
		navigation.open('list');
		uiSfx('ui-tap');
	});
	el('profile-account').addEventListener('click', () => {
		navigation.open('account');
		uiSfx('ui-tap');
	});
	window.addEventListener('checkers-profile-open', (event) => {
		const page = (event as CustomEvent<unknown>).detail;
		if (page === 'settings' || page === 'rules') navigation.open(page);
	});
	retry.addEventListener('click', () => {
		uiSfx('ui-tap');
		focusHeading();
		retryAction();
	});
	filter.addEventListener('change', () => {
		uiSfx('ui-tap');
		paintList();
		scroll.scrollTop = 0;
	});
	const navigate = (target: number) => {
		if (
			replay &&
			target !== ply &&
			target >= 0 &&
			target <= replay.plies.length
		) {
			uiSfx('ui-tap');
			paintPosition(target);
		}
	};
	first.addEventListener('click', () => navigate(0));
	prev.addEventListener('click', () => navigate(ply - 1));
	next.addEventListener('click', () => navigate(ply + 1));
	end.addEventListener('click', () => navigate(replay?.plies.length ?? 0));
	root.addEventListener('keydown', (event) => {
		if (event.key === 'Tab') {
			const controls = [
				...root.querySelectorAll<HTMLElement>(
					'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
				),
			].filter((node) => node.getClientRects().length > 0);
			const current = document.activeElement;
			const firstControl = controls[0],
				lastControl = controls.at(-1);
			if (
				firstControl &&
				lastControl &&
				(event.shiftKey
					? current === firstControl || current === heading
					: current === lastControl)
			) {
				event.preventDefault();
				(event.shiftKey ? lastControl : firstControl).focus();
			}
			return;
		}
		if (
			pane !== 'record' ||
			!selected ||
			!replay ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		)
			return;
		const target = event.target as HTMLElement;
		if (target.matches('input,select,textarea')) return;
		const positions: Record<string, number> = {
			ArrowLeft: ply - 1,
			ArrowRight: ply + 1,
			Home: 0,
			End: replay.plies.length,
		};
		if (event.key in positions) {
			event.preventDefault();
			paintPosition(positions[event.key]);
		}
	});
	navigation.restore();
}
