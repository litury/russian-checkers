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
 const cover = (on: boolean) => {
  root.hidden = !on;
  if (title) title.inert = on;
 };
 const showList = () => {
  boardWrap?.setAttribute('hidden', '');
  list.hidden = false;
  if (empty) empty.hidden = list.childElementCount > 0;
 };
 const openRoot = async () => {
  cover(true);
  list.replaceChildren();
  if (empty) empty.hidden = true;
  const rows = (await loadMatches()) ?? [];
  if (!rows.length) {
   if (empty) empty.hidden = false;
   const demo = document.createElement('button');
   demo.type = 'button';
   demo.className = 'mh-row';
   demo.textContent = 'Пример разбора';
   demo.addEventListener('click', () => {
    const start = createInitialPosition();
    const move = legalMoves(start)[0];
    if (!move || !board || !scrub) return;
    plies = [{ side: 'white', from: squareAlg(move.from), path: move.path.map(squareAlg) }];
    list.hidden = true;
    if (empty) empty.hidden = true;
    boardWrap?.removeAttribute('hidden');
    if (none) none.hidden = true;
    board.hidden = false;
    scrub.hidden = false;
    scrub.min = '0';
    scrub.max = '1';
    scrub.value = '0';
    paintBoard(board, plies, 0);
   });
   list.append(demo);
   showList();
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
  showList();
 };
 const openMatch = async (row: MatchRow) => {
  list.hidden = true;
  if (empty) empty.hidden = true;
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
