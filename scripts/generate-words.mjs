/**
 * scripts/generate-words.mjs
 * Hardened streaming pipeline: follows redirects with socket cleanup,
 * handles request timeouts, retries on 5xx, and performs atomic file writes.
 */

import https from 'node:https';
import http from 'node:http';
import zlib from 'node:zlib';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPRNG,
  hashString,
  extractCandidateWord,
  StratifiedWeightedSampler
} from './wotd-utils.mjs';

const PRIMARY_URL = process.env.SOURCE_URL || 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz';
const OUTPUT_FILE = path.resolve(process.cwd(), 'words.json');
const TEMP_FILE = path.resolve(process.cwd(), 'words.json.tmp');

export function fetchWithRetry(url, maxRedirects = 3, maxRetries = 3, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    function attempt(currentUrl, redirectCount, retryCount) {
      const client = currentUrl.startsWith('https') ? https : http;
      const req = client.get(currentUrl, { timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // Consume & release socket
          if (redirectCount >= maxRedirects) {
            return reject(new Error(`Exceeded max redirects (${maxRedirects})`));
          }
          return attempt(res.headers.location, redirectCount + 1, retryCount);
        }

        if (res.statusCode !== 200) {
          res.resume();
          if (retryCount < maxRetries) {
            console.warn(`HTTP ${res.statusCode} from ${currentUrl}. Retrying in ${3 * (retryCount + 1)}s...`);
            return setTimeout(() => attempt(currentUrl, redirectCount, retryCount + 1), 3000 * (retryCount + 1));
          }
          return reject(new Error(`HTTP ${res.statusCode} when fetching ${currentUrl}`));
        }

        resolve(res);
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        if (retryCount < maxRetries) {
          console.warn(`Network error (${err.message}). Retrying in ${3 * (retryCount + 1)}s...`);
          return setTimeout(() => attempt(currentUrl, redirectCount, retryCount + 1), 3000 * (retryCount + 1));
        }
        reject(err);
      });
    }

    attempt(url, 0, 0);
  });
}

export async function processDump(sourceStream = null, customSampler = null, outputFile = OUTPUT_FILE) {
  const seedStr = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth() + 1}`;
  const seed = hashString(seedStr);
  const rng = createPRNG(seed);

  const sampler = customSampler || new StratifiedWeightedSampler(
    { noun: 2250, verb: 1250, adj: 1100, adv: 400 },
    rng
  );

  let inputStream = sourceStream;
  let isGzip = true;

  if (!inputStream) {
    console.log(`Connecting to dictionary stream at ${PRIMARY_URL}...`);
    inputStream = await fetchWithRetry(PRIMARY_URL);
  }

  const decompressor = isGzip ? zlib.createGunzip() : null;
  const readable = decompressor ? inputStream.pipe(decompressor) : inputStream;

  const rl = readline.createInterface({
    input: readable,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let candidateCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (!line || line.charCodeAt(0) !== 123) continue;

    try {
      const entry = JSON.parse(line);
      const candidate = extractCandidateWord(entry);
      if (candidate) {
        candidateCount++;
        sampler.add(candidate);
      }
    } catch {
      // Skip corrupt individual lines without failing stream
    }

    if (lineCount % 100000 === 0) {
      console.log(`Processed ${lineCount.toLocaleString()} lines | Candidates: ${candidateCount.toLocaleString()}`);
    }
  }

  const samples = sampler.getSamples();
  console.log(`Finished stream parsing. Total lines: ${lineCount} | Candidates: ${candidateCount} | Sampled: ${samples.length}`);

  const tempFile = `${outputFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(samples, null, 2), 'utf8');
  fs.renameSync(tempFile, outputFile);
  console.log(`Atomic write complete: ${samples.length} words saved to ${outputFile} (${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB)`);

  return samples;
}

if (process.argv[1] && process.argv[1].endsWith('generate-words.mjs')) {
  processDump().catch(err => {
    console.error('Fatal error in generate-words:', err);
    if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
    process.exit(1);
  });
}
