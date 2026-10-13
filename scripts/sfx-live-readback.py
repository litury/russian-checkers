import hashlib,json,re,urllib.request,wave,math,array
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def get(url):
    with urllib.request.urlopen(url,timeout=30) as r:return r.read()
html=get('https://damka.fun/')
urls={('/assets/'+name.decode()).encode() for name in re.findall(rb'(?:src|href)="(?:\./|/)?assets/([^" ]+\.js)"',html)}
visited={}
while urls:
    path=urls.pop().decode(); body=get('https://damka.fun'+path);visited[path]=body
    for child in re.findall(rb'["\'](?:\./|/assets/)([^"\']+\.js)["\']',body):
        child='/assets/'+child.decode()
        if child not in visited:urls.add(child.encode())
assets=[]
for cue in ['crush-b','ignite-a']:
    matches=set()
    for body in visited.values():matches.update(re.findall((cue+r'-[^"\s/]+\.wav').encode(),body))
    assert len(matches)==1,(cue,matches)
    name=next(iter(matches)).decode();data=get('https://damka.fun/assets/'+name);local=(root/'src/client/app/audio/menu'/f'{cue}.wav').read_bytes()
    assert hashlib.sha256(data).digest()==hashlib.sha256(local).digest()
    import io
    w=wave.open(io.BytesIO(data));d=array.array('h',w.readframes(w.getnframes()));samples=[x/32768 for x in d];rms=math.sqrt(sum(x*x for x in samples)/len(samples));peak=max(abs(x) for x in samples)
    assets.append(dict(cue=cue,url='https://damka.fun/assets/'+name,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),duration=w.getnframes()/w.getframerate(),rms=rms,rmsDbfs=20*math.log10(rms),peak=peak,attack=next(i/w.getframerate() for i,x in enumerate(samples) if abs(x)>.001),defaultEffectiveGain=.4*.65,defaultRmsDbfs=20*math.log10(rms*.4*.65)))
result=dict(liveIndexSha256=hashlib.sha256(html).hexdigest(),bundles=[dict(url='https://damka.fun'+k,sha256=hashlib.sha256(v).hexdigest(),bytes=len(v)) for k,v in visited.items()],assets=assets,scope='Readback only; no claim live forced promotion or audible perception')
(root/'artifacts/sfx-live-readback.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
