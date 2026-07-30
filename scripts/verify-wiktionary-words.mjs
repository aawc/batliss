/**
 * scripts/verify-wiktionary-words.mjs
 * Validates words in words.json against the Wiktionary MediaWiki API in batches of 50.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const WORDS_FILE = path.resolve(process.cwd(), 'words.json');

export function queryMediaWikiBatch(words) {
  return new Promise((resolve, reject) => {
    const titles = words.map(w => encodeURIComponent(w)).join('|');
    const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${titles}&format=json`;

    https.get(url, { headers: { 'User-Agent': 'BatlissWordVerifier/1.0 (https://github.com/aawc/batliss)' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`MediaWiki API HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.query ? json.query.pages : {});
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

export async function verifyWords(sampleOnly = null) {
  const data = JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
  const wordList = sampleOnly ? data.slice(0, sampleOnly).map(x => x.w) : data.map(x => x.w);

  console.log(`Verifying ${wordList.length} words against Wiktionary MediaWiki API...`);
  const missingWords = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < wordList.length; i += BATCH_SIZE) {
    const batch = wordList.slice(i, i + BATCH_SIZE);
    const pages = await queryMediaWikiBatch(batch);

    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      if (page.missing !== undefined || parseInt(pageId, 10) < 0) {
        missingWords.push(page.title);
      }
    }

    if (i + BATCH_SIZE < wordList.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  if (missingWords.length > 0) {
    throw new Error(`Found ${missingWords.length} non-existent words on Wiktionary: ${missingWords.join(', ')}`);
  }

  console.log(`All ${wordList.length} words verified to exist on Wiktionary.`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('verify-wiktionary-words.mjs')) {
  verifyWords().catch(err => {
    console.error('Verification failed:', err.message);
    process.exit(1);
  });
}
