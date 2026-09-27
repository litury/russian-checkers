from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path.cwd()
base = root / 'evidence/coherent-menu'
out = root.parent / 't_e5970921-evidence.zip'
files = [base/'REPORT.md', base/'budgets.json', root/'build.log', root/'tests-final.log', root/'resilience.log']
files += list((base/'timing-1').glob('*.json'))
files += list((base/'timing-2').glob('*.json'))
files += list((base/'timing-3').glob('*.json'))
files += list((base/'final-timing').glob('*.json'))
files += list((base/'final-timing-2').glob('*.json'))
files += list((base/'resilience').glob('*.json'))
files += list((base/'retry').glob('*.json'))
files += list((root/'evidence/menu-loading-controls').glob('*'))
files += [root/'scripts'/name for name in ['coherent-menu-check.cjs','coherent-menu-budget.cjs','menu-ready-check.cjs','menu-loading-controls.cjs']]
film = base/'final-filmstrip'
for width in [390,1440]:
    for cache in ['cold','warm']:
        name = f'{width}-{cache}'
        files += [film/f'{name}.json', film/f'{name}-menu.png']
        data = json.loads((film/f'{name}.json').read_text())
        files += [film/frame['file'] for frame in data['captures'][:10]]
files.append(film/'summary.json')
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for file in dict.fromkeys(files):
        archive.write(file, str(file.relative_to(root)))
print(json.dumps({'artifact':str(out),'bytes':out.stat().st_size,'entries':len(dict.fromkeys(files))}))
