"""Offline accepted-source preparation; requires numpy and ffmpeg, no API calls.
Usage: python prepare_music_loops.py SOURCE_DIR OUTPUT_DIR REFERENCE_SHA
Source masters remain untouched. Output JSON records actual measurements.
"""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

import numpy as np


def run(args):
    return subprocess.run(args, check=True, capture_output=True)


def pcm(path, rate=44100, filters=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path)]
    if filters:
        cmd += ['-af', filters]
    cmd += ['-ar', str(rate), '-ac', '2', '-f', 'f32le', '-']
    return np.frombuffer(run(cmd).stdout, dtype='<f4').reshape(-1, 2).copy()


def loudness(path):
    result = run(['ffmpeg', '-hide_banner', '-i', str(path), '-af',
                  'loudnorm=print_format=json', '-f', 'null', '-'])
    text = result.stderr.decode()
    return json.loads(text[text.rfind('{'):text.rfind('}')+1])


def features(path):
    x = pcm(path, 11025).mean(axis=1)
    hop, size = 256, 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, size)[::hop]
    spec = abs(np.fft.rfft(frames * np.hanning(size), axis=1))
    freq = np.fft.rfftfreq(size, 1/11025)
    valid = (freq > 100) & (freq < 4000)
    pitch = np.rint(69+12*np.log2(freq[valid]/440)).astype(int) % 12
    chroma = np.stack([spec[:, valid][:, pitch == p].sum(axis=1) for p in range(12)], axis=1)
    chroma /= np.maximum(np.linalg.norm(chroma, axis=1, keepdims=True), 1e-9)
    flux = np.maximum(np.diff(np.log1p(spec), axis=0), 0).mean(axis=1)
    return chroma, flux, hop/11025


def choose_seam(path, nominal):
    chroma, flux, dt = features(path)
    # Estimate actual pulse around accepted prompt tempo; do not impose its BPM.
    flux = flux - flux.mean()
    lags = range(round(60/(nominal*1.12)/dt), round(60/(nominal*.88)/dt)+1)
    lag = max(lags, key=lambda n: float(np.dot(flux[n:], flux[:-n])))
    beat = lag*dt
    # Long continuous interior phrase, no terminal fade or intro. Compare whole
    # aligned bars (pitch class, onset and energy), not isolated zero crossings.
    candidates = []
    for bpm in np.arange(nominal*.95, nominal*1.05, .1):
        pulse = 60/bpm
        for beats in (32, 48, 64):
            period = beats*pulse
            fade = 4*pulse
            for start in np.arange(3, 47-period-fade, dt*4):
                end = start+period+fade
                a, b, count = round(start/dt), round((start+period)/dt), round(fade/dt)
                ca, cb = chroma[a:a+count], chroma[b:b+count]
                fa, fb = flux[a:a+count], flux[b:b+count]
                harmony = float(np.mean(np.sum(ca*cb, axis=1)))
                rhythm = float(np.dot(fa, fb)/(np.linalg.norm(fa)*np.linalg.norm(fb)+1e-9))
                score = harmony+.7*rhythm+.003*period
                candidates.append((score, start, end, fade, harmony, rhythm, beats))
    score, start, end, fade, harmony, rhythm, beats = max(candidates)
    return dict(start_sec=float(start), end_sec=float(end), crossfade_sec=float(fade),
                bpm_estimate=60/beat, seam_bpm=60*beats/(end-start-fade), beats=beats, chroma_similarity=harmony,
                onset_similarity=rhythm, score=score)


def encode(data, path):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2',
                    '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k', str(path)],
                   input=data.astype('<f4').tobytes(), check=True, capture_output=True)


def prepare(source, output, reference_sha):
    output.mkdir(parents=True, exist_ok=True)
    report = {'reference_sha': reference_sha, 'source_provenance': json.loads((source/'provenance.json').read_text()),
              'limitations': 'No audio perception in this environment. Spectral matching does not certify musical phrasing or removal of audible distortion. Owner accepted source character; QA must audition seams and A/B.', 'tracks': {}}
    for name, nominal, old in [('menu', 76, 'menu_music_source'), ('match', 94, 'match-b-90s')]:
        path = source/f'{name}-source.wav'
        original = pcm(path)
        seam = choose_seam(path, nominal)
        # Conservative interpolation only at full/near-full-scale runs. Preserve
        # every other sample; do not mistake attenuation for restoration.
        restored = original.copy()
        repaired = 0
        for channel in range(2):
            bad = np.flatnonzero(abs(original[:, channel]) >= 32767/32768)
            if len(bad):
                boundaries = np.split(bad, np.flatnonzero(np.diff(bad) > 1)+1)
                for group in boundaries:
                    lo, hi = int(group[0]), int(group[-1])
                    if lo >= 3 and hi+3 < len(original):
                        points = np.array([lo-3, lo-2, lo-1, hi+1, hi+2, hi+3])
                        values = original[points, channel].astype(float)
                        center = (lo+hi)/2
                        coef = np.polyfit(points-center, values, 3)
                        restored[group, channel] = np.clip(np.polyval(coef, group-center), -1.1, 1.1)
                        repaired += len(group)
        s, e, f = (round(seam[k]*44100) for k in ('start_sec', 'end_sec', 'crossfade_sec'))
        segment = restored[s:e]
        loop = segment[f:].copy()
        t = np.linspace(0, 1, f)
        w = (t*t*(3-2*t))[:, None]
        loop[-f:] = segment[-f:]*(1-w)+segment[:f]*w
        # Rotate the already cyclic PCM to a quiet, locally stable sample boundary.
        # This changes neither period nor note spacing, and does not add a splice.
        window = 4410
        wrapped = np.concatenate((loop[-window:], loop, loop[:window]))
        power = np.vstack((np.zeros((1, 2)), np.cumsum(wrapped.astype(float)**2, axis=0)))
        choices = []
        for offset in range(0, round(44100*60/seam['seam_bpm']), 64):
            at = window+offset
            before = (power[at]-power[at-window])/window
            after = (power[at+window]-power[at])/window
            delta = float(abs(10*np.log10(np.maximum(after, 1e-12)/np.maximum(before, 1e-12))).max())
            step = float(abs(wrapped[at]-wrapped[at-1]).max())
            choices.append((delta+step*50, offset))
        _, rotation = min(choices)
        loop = np.roll(loop, -rotation, axis=0)
        # Measure temporary full-resolution output, then static gain-match each
        # old bed independently. No uniform loudnorm and no runtime extra seam.
        raw = output/f'{name}-unmatched.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', str(raw)], input=loop.astype('<f4').tobytes(), check=True)
        reference = output/f'{name}-reference.mp3'
        reference.write_bytes(run(['git', 'show', f'{reference_sha}:src/client/app/audio/menu/{old}.mp3']).stdout)
        target = float(loudness(reference)['input_i'])
        reference.unlink()
        current = float(loudness(raw)['input_i'])
        gain = min(10**((target-current)/20), .89/float(abs(loop).max()))
        loop *= gain
        delivery = output/f'{name}-loop.mp3'
        encode(loop, delivery)
        decoded = pcm(delivery)
        # Short level-matched source/restored A/B around the greatest clipped run.
        if name == 'match':
            bad = np.flatnonzero(np.any(abs(original) >= 32767/32768, axis=1))
            pos = int(bad[len(bad)//2])
            a, b = max(0, pos-3*44100), min(len(original), pos+3*44100)
            encode(original[a:b]*.7, output/'match-clipping-before.mp3')
            encode(restored[a:b]*.7, output/'match-clipping-after.mp3')
        encode(np.tile(loop, (3, 1)), output/f'{name}-three-cycles.mp3')
        measured = loudness(delivery)
        result = {'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                  **seam, 'processing': 'Full/near-full-scale runs: local cubic interpolation; one continuous interior segment; 4-beat smoothstep end/head crossfade; cyclic rotation; static independent gain; MP3 192k.',
                  'repaired_samples': repaired, 'static_gain': gain,
                  'cyclic_rotation_frames': rotation,
                  'reference_lufs': target, 'delivery_loudness': measured,
                  'runtime_level_compensation': 10**((target-float(measured['input_i']))/20),
                  'sample_peak_dbfs': 20*math.log10(float(abs(decoded).max())),
                  'decoded_duration_sec': len(decoded)/44100,
                  'decoded_frames': len(decoded),
                  'seam_step': float(abs(decoded[0]-decoded[-1]).max()),
                  'sha256': hashlib.sha256(delivery.read_bytes()).hexdigest(),
                  'bytes': delivery.stat().st_size}
        report['tracks'][name] = result
        raw.unlink()
    (output/'processing.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report['tracks'], indent=2))


if __name__ == '__main__':
    prepare(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
