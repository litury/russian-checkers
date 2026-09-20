import { loadMatch, loadMatches } from '@/online/cloud';
import { canOpenBoard, type MatchRow } from '@/online/matchHistory';
import { plyToMove, positionAt, type RecordedPly } from '@/online/replay';
import { pickBotMove } from '@/client/modules/bot/pickBotMove';
import { createInitialPosition, legalMoves } from '@/rules';
import { squareAlg } from '@/online/notation';

function paintBoard(root: HTMLElement, plies: RecordedPly[], n: number) {
 const pos = positionAt(plies, n);
 const best = pickBotMove(pos, () => 0, 'normal');
 const dest = best?.path[best.path.length - 1];
 root.replaceChildren();
 for (let row = 7; row >= 0; row -= 1) {
  for (let col = 0; col < 8; col += 1) {
   const cell = document.createElement('i');
   cell.className = (row + col) % 2 ? 'mh-dark' : 'mh-light';
   const piece = pos.squares[row][col];
   if (piece) {
    cell.dataset.side = piece.side;
    cell.dataset.kind = piece.kind;
   }
   if (dest && dest.row === row && dest.col === col) cell.classList.add('mh-best');
   root.append(cell);
  }
 }
 const bar = document.getElementById('match-history-eval');
 if (bar) {
  if (n <= 0) { bar.hidden = true; return; }
  const prev = positionAt(plies, n - 1);
  const rec = pickBotMove(prev, () => 0, 'normal');
  const played = plyToMove(plies[n - 1]);
  const same = !!(rec && played && rec.from.row === played.from.row && rec.from.col === played.from.col
   && rec.path.length === played.path.length
   && rec.path.every((s, i) => s.row === played.path[i].row && s.col === played.path[i].col));
  bar.hidden = false;
  bar.className = same ? 'mh-ok' : 'mh-alt';
 }
}

export function bindMatchHistory() {
 const open = document.getElementById('opening-history');
 const root = document.getElementById('match-history');
 const list = document.getElementById('match-history-list');
 const empty = document.getElementById('match-history-empty');
 const boardWrap = document.getElementById('match-history-board');
 const board = document.getElementById('match-history-grid');
 const scrub = document.getElementById('match-history-scrub') as HTMLInputElement | null;
 const none = document.getElementById('match-history-none');
 const back = document.getElementById('match-history-back');
 if (!open || !root || !list) return;
 const title = document.getElementById('opening');
 let plies: RecordedPly[] = [];
 const loading = document.createElement('p');
 loading.id = 'match-history-loading';
 loading.hidden = true;
 loading.textContent = 'Загрузка…';
 const errorBox = document.createElement('div');
 errorBox.id = 'match-history-error';
 errorBox.hidden = true;
 const errorText = document.createElement('p');
 errorText.textContent = 'Не удалось загрузить партии. Проверьте сеть и повторите.';
 const retry = document.createElement('button');
 retry.type = 'button';
 retry.className = 'mh-row';
 retry.textContent = 'Повторить';
 errorBox.append(errorText, retry);
 (empty ?? list).before(loading, errorBox);
 const cover = (on: boolean) => {
  root.hidden = !on;
  if (title) title.inert = on;
 };
 const setPane = (pane: 'loading' | 'empty' | 'error' | 'list') => {
  loading.hidden = pane !== 'loading';
  errorBox.hidden = pane !== 'error';
  if (empty) empty.hidden = pane !== 'empty';
  list.hidden = pane !== 'list' && pane !== 'empty';
 };
 const showList = () => {
  boardWrap?.setAttribute('hidden', '');
  const hasRows = [...list.querySelectorAll('.mh-row')].some((el) => el.textContent !== 'Пример разбора');
  const hasDemo = list.querySelector('.mh-row') !== null;
  if (errorBox.hidden === false) setPane('error');
  else if (!hasRows && hasDemo) setPane('empty');
  else if (hasRows) setPane('list');
  else setPane('empty');
  list.hidden = false;
 };
 const openDemo = () => {
  const start = createInitialPosition();
  const move = legalMoves(start)[0];
  if (!move || !board || !scrub) return;
  plies = [{ side: 'white', from: squareAlg(move.from), path: move.path.map(squareAlg) }];
  list.hidden = true;
  if (empty) empty.hidden = true;
  loading.hidden = true;
  errorBox.hidden = true;
  boardWrap?.removeAttribute('hidden');
  if (none) none.hidden = true;
  board.hidden = false;
  scrub.hidden = false;
  scrub.min = '0';
  scrub.max = '1';
  scrub.value = '0';
  paintBoard(board, plies, 0);
 };
 const openRoot = async () => {
  cover(true);
  list.replaceChildren();
  boardWrap?.setAttribute('hidden', '');
  setPane('loading');
  const rows = await loadMatches();
  if (rows === null) {
   setPane('error');
   return;
  }
  if (!rows.length) {
   const demo = document.createElement('button');
   demo.type = 'button';
   demo.className = 'mh-row';
   demo.textContent = 'Пример разбора';
   demo.addEventListener('click', openDemo);
   list.append(demo);
   setPane('empty');
   list.hidden = false;
   return;
  }
  for (const row of rows) {
   const li = document.createElement('button');
   li.type = 'button';
   li.className = 'mh-row';
   const when = row.startedAt ? new Date(row.startedAt).toLocaleDateString('ru') : '';
   const cut = !canOpenBoard(row);
   li.innerHTML = `<span class="mh-disk mh-${row.color}"></span><span>${row.mode === 'bot' ? 'Бот' : 'Человек'}</span><span>${when}</span>${cut ? '<span>обрыв</span>' : ''}`;
   if (!cut) li.addEventListener('click', () => void openMatch(row));
   list.append(li);
  }
  setPane('list');
 };
 const openMatch = async (row: MatchRow) => {
  list.hidden = true;
  if (empty) empty.hidden = true;
  loading.hidden = true;
  errorBox.hidden = true;
  boardWrap?.removeAttribute('hidden');
  if (!canOpenBoard(row) || !board || !scrub) {
   if (none) none.hidden = false;
   if (board) board.hidden = true;
   if (scrub) scrub.hidden = true;
   return;
  }
  const detail = await loadMatch(row.id);
  if (!detail?.pliesList?.length) {
   if (none) none.hidden = false;
   board.hidden = true;
   scrub.hidden = true;
   return;
  }
  if (none) none.hidden = true;
  board.hidden = false;
  scrub.hidden = false;
  plies = detail.pliesList;
  scrub.min = '0';
  scrub.max = String(plies.length);
  scrub.value = String(plies.length);
  paintBoard(board, plies, plies.length);
 };
 scrub?.addEventListener('input', () => {
  if (!board) return;
  paintBoard(board, plies, Number(scrub.value));
 });
 retry.addEventListener('click', () => { void openRoot(); });
 open.addEventListener('click', () => { void openRoot(); });
 back?.addEventListener('click', () => {
  if (boardWrap && !boardWrap.hasAttribute('hidden')) {
   showList();
   return;
  }
  root.hidden = true;
  if (title) title.inert = false;
 });
}
