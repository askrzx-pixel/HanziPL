# HanziPL audio generator

Generator buduje bibliotekę pre-recorded audio dla słów z `js/words.js`.

## Wymagane env vars

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION` albo `AZURE_SPEECH_ENDPOINT`

Opcjonalnie:

- `AZURE_SPEECH_VOICE=zh-CN-XiaoxiaoNeural`
- `AZURE_SPEECH_FORMAT=audio-16khz-32kbitrate-mono-mp3`

## Przykłady

Wygeneruj mały batch testowy:

```bash
AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... \
node scripts/generate-word-audio.mjs --segment=1 --limit=10
```

Wygeneruj jedną lekcję:

```bash
AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... \
node scripts/generate-word-audio.mjs --lesson="1.3 Przedstawianie się"
```

Dry run bez wywołań do Azure:

```bash
node scripts/generate-word-audio.mjs --segment=1 --limit=5 --dry-run
```

Pliki są zapisywane do `audio/words/` i nazywane po stabilnym `id`, np. `w0001.mp3`.
