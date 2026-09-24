import { expect, it, vi } from 'vitest';
vi.mock('@/online/cloud', () => ({loadColorStats:async()=>null}));
import { paintOpeningStats } from './openingStats';

it('error never exposes stale totals or menu retry; diagnostics remain available', () => {
 const nodes = {root:{classList:{toggle:vi.fn()}},label:{hidden:true,textContent:'',dataset:{}},retry:{hidden:false,disabled:false},white:{textContent:'19',classList:{toggle:vi.fn()},setAttribute:vi.fn()},black:{textContent:'21',classList:{toggle:vi.fn()},setAttribute:vi.fn()}};
 paintOpeningStats('error',{white:19,black:21,games:40},nodes);
 expect(nodes.white.textContent).toBe('—');
 expect(nodes.black.textContent).toBe('—');
 expect(nodes.retry.hidden).toBe(true);
 expect(nodes.label.hidden).toBe(false);
 expect(nodes.label.textContent).toBe('Статистика недоступна');
 paintOpeningStats('loading',{white:19,black:21,games:40},nodes);
 expect(nodes.white.textContent).toBe('');
 expect(nodes.white.classList.toggle).toHaveBeenCalledWith('is-stat-pending', true);
 expect(nodes.retry.hidden).toBe(true);
 paintOpeningStats('ready',{white:19,black:21,games:40},nodes);
 expect(nodes.white.textContent).toBe('19');
 expect(nodes.black.textContent).toBe('21');
 expect(nodes.label.hidden).toBe(true);
 expect(nodes.retry.hidden).toBe(true);
});
