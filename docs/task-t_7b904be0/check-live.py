import json
rows=json.load(open('docs/task-t_7b904be0/live-measurements.json'))
network=json.load(open('docs/task-t_7b904be0/live-network.json'))
required={'online-hub','searching','waiting','waiting-late','timeout-offer','friend-enter','friend-miss','friend-wait','found','offline'}
for r in rows:
 assert required=={m['phase'] for m in r['measurements']}
 titles=[l for m in r['measurements'] if m['phase']!='online-hub' for l in m['title']['lines']]
 counts=[l for m in r['measurements'] if m.get('count') and m['count']['visible'] for l in m['count']['lines']]
 back=next(m['back'] for m in r['measurements'] if 'back' in m)
 assets=next(n['assets'] for n in network if n['width']==r['width'] and n['dpr']==r['dpr'])
 print(r['width'],r['dpr'],'title min',min(min(l['left'],l['right']) for l in titles),'count min',min(min(l['left'],l['right']) for l in counts),'back min',min(min(l['left'],l['right']) for l in back['lines']),'search requests',len(assets),'bytes',sum(n['bytes'] for n in assets),'states',len([n for n in assets if 'search-button-' in n['url']]),'errors',r['errors'])
 assert all(min(l['left'],l['right'])>=8 for l in titles+counts+back['lines'])
 assert len(assets)==8
 assert len([n for n in assets if 'search-button-' in n['url']])==5
 assert not r['errors']
