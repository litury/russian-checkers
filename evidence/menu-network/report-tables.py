from pathlib import Path
import json,statistics
root=Path(__file__).parent
lines=['# Измерения: медиана [min–max], мс; n=3','', '| Серия / экран / cache | Paint | Цельное меню | Click → ход | Navigation → ход | Long tasks (count / ms) |','|---|---|---|---|---|---|']
for directory in ['isolated-baseline','isolated-final','candidate-before-clean','candidate-after-clean']:
 data=json.loads((root/directory/'analysis.json').read_text()) if (root/directory/'analysis.json').exists() else [dict(json.loads(p.read_text())['summary']) for p in sorted((root/directory).glob('*-cold.json'))]+[dict(json.loads(p.read_text())['summary']) for p in sorted((root/directory).glob('*-warm.json'))]
 for width in [390,1440]:
  for cache in ['cold','warm']:
   samples=[r for r in data if r['viewport']['width']==width and r['cache']==cache]
   if not samples:continue
   for r in samples:r['clickToPlayed']=r['played']-r['click']
   def metric(key):
    v=[r[key] for r in samples];return f'{statistics.median(v):.0f} [{min(v):.0f}–{max(v):.0f}]'
   lines.append('| '+f'{directory} / {width} / {cache}'+' | '+' | '.join(metric(k) for k in ['firstPaint','firstWhole','clickToPlayed','played'])+f' | {metric("longTasks")} / {metric("longTaskMs")} |')
lines += ['','Только isolated-* — заключительная серия после передачи слота illustrator. Остальные серии — диагностические, изоляция всей ранней истории не доказана.','', '# Сеть до sampled цельного меню (не минимальный набор барьера)','| Серия / viewport / cache | Requests | transfer bytes |','|---|---|---|']
for directory in ['isolated-baseline','isolated-final']:
 for r in json.loads((root/directory/'analysis.json').read_text()):
  if r['repeat']==0:lines.append(f'| {directory} / {r["viewport"]["width"]} / {r["cache"]} | {r["critical"]["count"]} | {r["critical"]["bytes"]} |')
(root/'TABLES.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
