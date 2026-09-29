"""Indonesian Story Mode narration with Microsoft Edge neural voices (free, native Indonesian).

ElevenLabs' free plan can't use library voices through the API, so the Indonesian narrator uses
Edge's "Ardi" voice instead. Output matches generate-narration.mjs: assets/audio/story/id/<chapter>.{mp3,json}
with caption sentences and beat start times, so the page stays in sync with the voice.

Usage (inside v2/story):  pip install edge-tts   then   python generate-narration-edge.py [--force] [--lang id]
"""
import asyncio
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import edge_tts

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'assets' / 'audio' / 'story'
VOICES = {'id': 'id-ID-ArdiNeural', 'en': 'en-US-AndrewMultilingualNeural'}
RATE = '-6%'
FORCE = '--force' in sys.argv
LANG = sys.argv[sys.argv.index('--lang') + 1] if '--lang' in sys.argv else 'id'

cfg = (HERE.parent / 'js' / 'config.js').read_text(encoding='utf8')
project = re.search(r"projectId:\s*'([^']+)'", cfg).group(1)
key = re.search(r"apiKey:\s*'([^']+)'", cfg).group(1)


def plain(v):
    if not v:
        return None
    if 'stringValue' in v:
        return v['stringValue']
    if 'integerValue' in v:
        return int(v['integerValue'])
    if 'arrayValue' in v:
        return [plain(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v:
        return {k: plain(x) for k, x in v['mapValue'].get('fields', {}).items()}
    return None


url = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/story?pageSize=50&key={key}'
docs = json.load(urllib.request.urlopen(url)).get('documents', [])
chapters = [(d['name'].split('/')[-1], plain(d['fields'].get('beats')) or []) for d in docs]

strip = lambda t: re.sub(r'\s{2,}', ' ', re.sub(r'\[[^\]]*\]\s*', '', t)).strip()
# a spoken pause where the script asked for one
prep = lambda t: re.sub(r'\s{2,}', ' ', re.sub(r'\[pause\]\s*', '... ', t, flags=re.I)).strip()


async def synth(text):
    audio, words = bytearray(), []
    com = edge_tts.Communicate(text, VOICES[LANG], rate=RATE, boundary='WordBoundary')
    async for chunk in com.stream():
        if chunk['type'] == 'audio':
            audio += chunk['data']
        elif chunk['type'] == 'WordBoundary':
            words.append((chunk['offset'] / 1e7, (chunk['offset'] + chunk['duration']) / 1e7, chunk['text']))
    return bytes(audio), words


def timeline(beat_texts, words):
    """Map words back onto beats and sentences by walking the script word by word."""
    beats, sentences, wi = [], [], 0
    norm = lambda w: re.sub(r'\W+', '', w.lower())
    for focus, text in beat_texts:
        start = words[wi][0] if wi < len(words) else (words[-1][1] if words else 0)
        for sent in re.findall(r'.+?(?:[.!?…]+["\')\]]*(?=\s|$)|$)', text):
            sent = sent.strip()
            if not sent:
                continue
            tokens = [t for t in (norm(x) for x in sent.split()) if t]
            s0 = words[wi][0] if wi < len(words) else start
            end = s0
            for tok in tokens:
                # advance through the spoken words until this token is matched (tolerates merged/split words)
                for j in range(wi, min(wi + 4, len(words))):
                    if norm(words[j][2]) and (norm(words[j][2]) in tok or tok in norm(words[j][2])):
                        end = words[j][1]
                        wi = j + 1
                        break
            sentences.append({'text': sent, 'start': round(s0, 3), 'end': round(end, 3)})
        beats.append({'focus': focus, 'start': round(start, 3)})
    for k, b in enumerate(beats):
        b['end'] = beats[k + 1]['start'] if k + 1 < len(beats) else (words[-1][1] if words else 0)
    return beats, sentences


async def main():
    made = kept = 0
    for chapter, beats in chapters:
        parts = [(b.get('focus', ''), strip(prep(b.get(LANG) or ''))) for b in beats if (b.get(LANG) or '').strip()]
        if not parts:
            continue
        source = ' '.join(prep(b.get(LANG) or '').strip() for b in beats if (b.get(LANG) or '').strip())
        dest = OUT / LANG
        dest.mkdir(parents=True, exist_ok=True)
        js = dest / f'{chapter}.json'
        if not FORCE and js.exists():
            prev = json.loads(js.read_text(encoding='utf8'))
            if prev.get('source') == source and prev.get('voice') == VOICES[LANG]:
                kept += 1
                continue
        audio, words = await synth(' '.join(t for _, t in parts))
        tl_beats, sentences = timeline(parts, words)
        (dest / f'{chapter}.mp3').write_bytes(audio)
        js.write_text(json.dumps({'source': source, 'text': ' '.join(t for _, t in parts), 'voice': VOICES[LANG], 'model': 'edge-neural',
                                  'beats': tl_beats, 'sentences': sentences,
                                  'words': [{'w': w, 't': round(t0, 3)} for t0, _, w in words]}, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
        made += 1
        print(f'✓ {LANG}/{chapter}  {tl_beats[-1]["end"]:.1f}s  ({len(tl_beats)} beats, {len(sentences)} sentences)')
    print(f'\nDone: {made} generated, {kept} unchanged. (free — no ElevenLabs credits)')

asyncio.run(main())
