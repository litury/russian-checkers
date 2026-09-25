import './matchHistory.css';
import { loadMatch, loadMatches } from '@/online/cloud';
import { canOpenBoard, type MatchRow } from '@/online/matchHistory';
import { buildHistoryReplay, halfMoveCount, incompleteReplayCopy, outcomeLabel } from '@/online/historyReplay';
import { squareAlg } from '@/online/notation';
import type { Side } from '@/rules';

const dateLabel = (value: string) => {
 const date = new Date(value);
 return Number.isFinite(date.getTime())
  ? date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Дата не указана';
};
const opponent = (row: MatchRow) => row.mode === 'bot' ? 'Компьютер' : 'Соперник онлайн';
const sideLabel = (row: MatchRow) => row.color === 'white' ? 'Вы — белые' : 'Вы — чёрные';
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
 const node = document.createElement(tag);
 node.className = className;
 node.textContent = text;
 return node;
};

export function bindMatchHistory() {
 const open = document.getElementById('opening-history');
 const root = document.getElementById('match-history') as HTMLDialogElement | null;
 if (!open || !root || root.dataset.bound) return;
 root.dataset.bound = 'true';
 const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const title = el('opening');
 const heading = el('match-history-title');
 const back = el<HTMLButtonElement>('match-history-back');
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
 let rows: MatchRow[] = [];
 let selected: MatchRow | null = null;
 let replay: ReturnType<typeof buildHistoryReplay> | null = null;
 let ply = 0, generation = 0, savedScroll = 0;
 let returnFocus: HTMLElement | null = null;
 let retryAction = () => { void fetchList(); };
 let archiveState: 'loading' | 'error' | 'empty' | 'list' = 'loading';
 const navigationKey = `history-${Date.now()}`;
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
  const visible = rows.filter(row => filter.value === 'all' || row.mode === filter.value);
  el('match-history-summary').textContent = `${visible.length} в списке · Сначала новые`;
  for (const row of visible) {
   const item = element('article', 'mh-row');
   const outcome = element('div', 'mh-outcome', outcomeLabel(row));
   outcome.dataset.outcome = row.winner === null ? 'unknown' : row.winner === 'draw' ? 'draw' : row.winner === row.color ? 'win' : 'loss';
   const info = element('div', 'mh-row-info');
   const name = element('h3', '', opponent(row));
   const date = element('time', '', dateLabel(row.startedAt));
   if (Number.isFinite(Date.parse(row.startedAt))) date.dateTime = row.startedAt;
   info.append(name, date);
   const detail = element('p', 'mh-row-detail', `${sideLabel(row)} · ${halfMoveCount(row.plies)}`);
   const action = element('div', 'mh-row-action');
   if (canOpenBoard(row)) {
    const button = element('button', 'mh-button', 'Смотреть');
    button.type = 'button';
    button.setAttribute('aria-label', `Смотреть: ${outcomeLabel(row)}, ${opponent(row)}, ${dateLabel(row.startedAt)}`);
    button.addEventListener('click', () => {
     savedScroll = scroll.scrollTop;
     returnFocus = button;
     history.pushState({ mh: navigationKey, pane: 'record' }, '');
     void openMatch(row);
    });
    action.append(button);
   } else action.append(element('span', 'mh-muted', 'Ходы не записаны'));
   item.append(outcome, info, detail, action);
   list.append(item);
  }
 };
 const restoreList = () => {
  generation++;
  selected = null;
  replay = null;
  heading.textContent = 'Мои партии';
  back.textContent = 'В меню';
  boardWrap.hidden = true;
  archive.hidden = archiveState !== 'list';
  state.hidden = archiveState === 'list';
  if (archiveState === 'error') showState('Не удалось загрузить партии', 'Проверьте соединение и попробуйте ещё раз.', () => { void fetchList(); });
  else if (archiveState === 'empty') showState('Пока нет партий', 'Для этого профиля нет записанных партий. Записи связаны с профилем в этом браузере.');
  else if (archiveState === 'loading') { void fetchList(); }
  scroll.scrollTop = savedScroll;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else focusHeading();
 };
 const close = () => {
  generation++;
  root.close();
  title.inert = false;
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
   showState('Не удалось загрузить партии', 'Проверьте соединение и попробуйте ещё раз.', () => { void fetchList(); });
  } else {
   rows = result.slice().sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0));
   archiveState = rows.length ? 'list' : 'empty';
   const bothModes = new Set(rows.map(row => row.mode)).size > 1;
   el('match-history-filter-label').hidden = !bothModes;
   if (!bothModes) filter.value = 'all';
   el('match-history-limit').hidden = rows.length < 50;
   if (!rows.length) showState('Пока нет партий', 'Для этого профиля нет записанных партий. Записи связаны с профилем в этом браузере.');
   else { state.hidden = true; archive.hidden = false; paintList(); }
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
  const rows = facing === 'black' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  for (const row of rows) {
   for (let col = 0; col < 8; col++) {
    const square = squareAlg({ row, col });
    const cell = element('i', 'mh-cell');
    cell.dataset.square = square;
    const piece = position.squares[row][col];
    if (piece) {
     cell.dataset.side = piece.side;
     cell.dataset.kind = piece.kind;
     description.push(`${square}: ${piece.side === 'white' ? 'белая' : 'чёрная'} ${piece.kind === 'king' ? 'дамка' : 'шашка'}`);
    }
    if (last && (last.from === square || last.path.at(-1) === square)) cell.classList.add('mh-last');
    board.append(cell);
   }
  }
  board.setAttribute('aria-label', `Полуход ${ply}. ${description.join('; ')}`);
  first.disabled = prev.disabled = ply === 0;
  next.disabled = end.disabled = ply === replay.plies.length;
  el('match-history-ply').textContent = `Полуход ${ply} из ${replay.plies.length} · ${ply ? replay.notation[ply - 1] : 'Начальная позиция'}`;
  notation.querySelectorAll('button').forEach((button, i) => {
   if (i + 1 === ply) button.setAttribute('aria-current', 'step');
   else button.removeAttribute('aria-current');
  });
  const active = notation.querySelector<HTMLElement>('[aria-current]');
  if (!active) notation.scrollTop = 0;
  else {
   // offsetTop is relative to the positioned notation itself; subtracting notation.offsetTop scrolled to the wrong ply.
   const top = active.getBoundingClientRect().top - notation.getBoundingClientRect().top + notation.scrollTop;
   notation.scrollTop = Math.max(0, top - (notation.clientHeight - active.offsetHeight) / 2);
  }
 };
 async function openMatch(row: MatchRow) {
  selected = row;
  replay = null;
  const ticket = ++generation;
  heading.textContent = 'Просмотр партии';
  back.textContent = 'К списку';
  archive.hidden = true;
  boardWrap.hidden = true;
  scroll.scrollTop = 0;
  focusHeading();
  showState('Загрузка записи…', `${opponent(row)} · ${dateLabel(row.startedAt)}`);
  const result = await loadMatch(row.id);
  if (ticket !== generation || !root?.open) return;
  if (result.status === 'error') {
   showState('Не удалось загрузить запись', 'Проверьте соединение и попробуйте ещё раз.', () => { void openMatch(row); });
   return;
  }
  if (result.status === 'missing') { showState('Запись недоступна', 'Партия не найдена или недоступна этому профилю. Вернитесь к списку.'); return; }
  const detail = result.detail;
  if (!detail.pliesList.length) { showState('Ходы не записаны', 'Партия есть в истории, но запись её ходов пуста.'); return; }
  replay = buildHistoryReplay(detail.pliesList, Math.max(detail.plies, row.plies));
  replay.incomplete ||= detail.plies !== detail.pliesList.length;
  if (!replay.plies.length) { showState('Запись повреждена', 'Первый ход не удаётся воспроизвести. Позиции не восстановлены.'); return; }
  el('match-history-result').textContent = outcomeLabel(detail);
  el('match-history-meta').textContent = `${opponent(detail)} · ${sideLabel(detail)} · ${dateLabel(detail.startedAt)}`;
  const warning = el('match-history-warning');
  warning.hidden = !replay.incomplete && detail.winner !== null;
  warning.textContent = replay.incomplete
   ? incompleteReplayCopy(replay.plies.length)
   : 'Результат не записан. Показаны только сохранённые ходы.';
  notation.replaceChildren();
  replay.notation.forEach((move, i) => {
   const button = element('button', 'mh-move', `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${move}`);
   button.type = 'button';
   button.setAttribute('aria-label', `Полуход ${i + 1}: ${move}`);
   button.addEventListener('click', () => paintPosition(i + 1));
   notation.append(button);
  });
  state.hidden = true;
  boardWrap.hidden = false;
  paintPosition(0);
 }
 open.addEventListener('click', () => {
  if (root.open) return;
  title.inert = true;
  root.showModal();
  selected = null;
  returnFocus = null;
  savedScroll = 0;
  filter.value = 'all';
  heading.textContent = 'Мои партии';
  back.textContent = 'В меню';
  focusHeading();
  history.pushState({ mh: navigationKey, pane: 'list' }, '');
  void fetchList();
 });
 const goBack = () => { generation++; history.back(); };
 back.addEventListener('click', goBack);
 root.addEventListener('cancel', event => { event.preventDefault(); goBack(); });
 window.addEventListener('popstate', event => {
  if (!root?.open) return;
  if (event.state?.mh === navigationKey && event.state.pane === 'list') restoreList();
  else close();
 });
 retry.addEventListener('click', () => { focusHeading(); retryAction(); });
 filter.addEventListener('change', () => { paintList(); scroll.scrollTop = 0; });
 first.addEventListener('click', () => paintPosition(0));
 prev.addEventListener('click', () => paintPosition(ply - 1));
 next.addEventListener('click', () => paintPosition(ply + 1));
 end.addEventListener('click', () => paintPosition(replay?.plies.length ?? 0));
 root.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
   const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),[tabindex="0"]')]
    .filter(node => node.getClientRects().length > 0);
   const current = document.activeElement;
   const firstControl = controls[0], lastControl = controls.at(-1);
   if (firstControl && lastControl && (event.shiftKey ? current === firstControl || current === heading : current === lastControl)) {
    event.preventDefault();
    (event.shiftKey ? lastControl : firstControl).focus();
   }
   return;
  }
  if (!selected || !replay || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement;
  if (target.matches('input,select,textarea')) return;
  const positions: Record<string, number> = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: replay.plies.length };
  if (event.key in positions) { event.preventDefault(); paintPosition(positions[event.key]); }
 });
}
