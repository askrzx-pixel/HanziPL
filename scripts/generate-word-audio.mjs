#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WORDS_PATH = path.join(REPO_ROOT, 'js', 'words.js');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'audio', 'words');

function printHelp() {
  console.log(`
HanziPL audio generator

Usage:
  node scripts/generate-word-audio.mjs [options]

Options:
  --segment=1              Generate only words from a segment number.
  --lesson="1.3 ..."      Generate only words from one sourceLesson.
  --id=w0001,w0002        Generate only selected record ids.
  --limit=25              Process only the first N matching words.
  --output-dir=audio/...  Override output directory.
  --voice=zh-CN-XiaoxiaoNeural
  --dry-run               Show what would be generated without calling Azure.
  --help                  Show this help.

Required env vars:
  AZURE_SPEECH_KEY
  AZURE_SPEECH_REGION     or AZURE_SPEECH_ENDPOINT

Optional env vars:
  AZURE_SPEECH_VOICE      default: zh-CN-XiaoxiaoNeural
  AZURE_SPEECH_FORMAT     default: audio-16khz-32kbitrate-mono-mp3
`);
}

function parseArgs(argv) {
  const options = {
    segment: null,
    lesson: null,
    ids: null,
    limit: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    voice: process.env.AZURE_SPEECH_VOICE || 'zh-CN-XiaoxiaoNeural',
    dryRun: false
  };

  argv.forEach(function(arg) {
    if (arg === '--help') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--segment=')) options.segment = String(arg.split('=').slice(1).join('=')).trim();
    else if (arg.startsWith('--lesson=')) options.lesson = String(arg.split('=').slice(1).join('=')).trim();
    else if (arg.startsWith('--id=')) {
      options.ids = String(arg.split('=').slice(1).join('='))
        .split(',')
        .map(function(id) { return id.trim(); })
        .filter(Boolean);
    } else if (arg.startsWith('--limit=')) {
      const limit = parseInt(arg.split('=').slice(1).join('='), 10);
      options.limit = Number.isFinite(limit) && limit > 0 ? limit : null;
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(REPO_ROOT, arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--voice=')) {
      options.voice = String(arg.split('=').slice(1).join('=')).trim() || options.voice;
    }
  });

  return options;
}

async function loadWords() {
  const source = await fs.readFile(WORDS_PATH, 'utf8');
  const words = vm.runInNewContext(source + '\n; WORDS;', {}, { filename: WORDS_PATH });
  if (!Array.isArray(words)) {
    throw new Error('Nie udało się wczytać tablicy WORDS z js/words.js.');
  }
  return words;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getSpeechEndpoint() {
  const rawEndpoint = (process.env.AZURE_SPEECH_ENDPOINT || '').trim();
  if (rawEndpoint) {
    return rawEndpoint.endsWith('/cognitiveservices/v1')
      ? rawEndpoint
      : rawEndpoint.replace(/\/+$/, '') + '/cognitiveservices/v1';
  }

  const region = (process.env.AZURE_SPEECH_REGION || '').trim();
  if (!region) {
    throw new Error('Brak AZURE_SPEECH_REGION lub AZURE_SPEECH_ENDPOINT.');
  }

  return 'https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1';
}

function buildSsml(hanzi, voice) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<speak version="1.0" xml:lang="zh-CN">',
    '<voice name="' + escapeXml(voice) + '">' + escapeXml(hanzi) + '</voice>',
    '</speak>'
  ].join('');
}

function filterWords(words, options) {
  let filtered = words.filter(function(word) {
    return word &&
      word.contentStatus !== 'unresolved' &&
      typeof word.id === 'string' &&
      word.id.trim() &&
      typeof word.hanzi === 'string' &&
      word.hanzi.trim();
  });

  if (options.segment) {
    filtered = filtered.filter(function(word) {
      const match = String(word.sourceLesson || '').match(/^(\d+)\./);
      return match && match[1] === options.segment;
    });
  }

  if (options.lesson) {
    filtered = filtered.filter(function(word) {
      return String(word.sourceLesson || '').trim() === options.lesson;
    });
  }

  if (Array.isArray(options.ids) && options.ids.length) {
    const idSet = new Set(options.ids);
    filtered = filtered.filter(function(word) { return idSet.has(word.id); });
  }

  filtered.sort(function(a, b) {
    return String(a.id).localeCompare(String(b.id));
  });

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

async function generateAudio(word, options, endpoint, outputFormat) {
  const filename = word.id + '.mp3';
  const targetPath = path.join(options.outputDir, filename);

  try {
    await fs.access(targetPath);
    return { status: 'skipped', word: word, file: targetPath };
  } catch (_) {
    // File does not exist yet.
  }

  if (options.dryRun) {
    return { status: 'generated', word: word, file: targetPath, dryRun: true };
  }

  const key = (process.env.AZURE_SPEECH_KEY || '').trim();
  if (!key) {
    throw new Error('Brak AZURE_SPEECH_KEY.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'hanzipl-audio-generator'
    },
    body: buildSsml(word.hanzi, options.voice)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error('Azure TTS error ' + response.status + ': ' + body.slice(0, 180));
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
  return { status: 'generated', word: word, file: targetPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const words = await loadWords();
  const batch = filterWords(words, options);

  if (!batch.length) {
    console.log('Brak rekordów do przetworzenia dla podanych filtrów.');
    return;
  }

  await fs.mkdir(options.outputDir, { recursive: true });

  const endpoint = options.dryRun ? null : getSpeechEndpoint();
  const outputFormat = (process.env.AZURE_SPEECH_FORMAT || 'audio-16khz-32kbitrate-mono-mp3').trim();

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const word of batch) {
    try {
      const result = await generateAudio(word, options, endpoint, outputFormat);
      if (result.status === 'generated') generated += 1;
      if (result.status === 'skipped') skipped += 1;
      console.log('[' + result.status + '] ' + word.id + ' ← ' + word.hanzi);
    } catch (error) {
      failed += 1;
      failures.push({ id: word.id, hanzi: word.hanzi, error: error.message });
      console.error('[failed] ' + word.id + ' ← ' + word.hanzi + ' :: ' + error.message);
    }
  }

  console.log('\nRaport:');
  console.log('- generated: ' + generated);
  console.log('- skipped existing: ' + skipped);
  console.log('- failed: ' + failed);

  if (failures.length) {
    console.log('\nBłędy:');
    failures.forEach(function(item) {
      console.log('- ' + item.id + ' (' + item.hanzi + '): ' + item.error);
    });
    process.exitCode = 1;
  }
}

main().catch(function(error) {
  console.error(error.message || error);
  process.exit(1);
});
