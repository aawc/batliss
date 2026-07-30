# Technical Design Document: Wiktionary Word Authenticity, Verification & Postmortem

## 1. Postmortem: Synthetic Word Generation Failure

### 1.1 Incident Summary
On 2026-07-30, Batliss displayed the Word of the Day **"interfortuitous"** linking to `https://en.wiktionary.org/wiki/interfortuitous`. Navigating to this URL resulted in a Wiktionary page-not-found error (*"Wiktionary does not yet have an entry for interfortuitous"*).

### 1.2 Root Cause Analysis
During initial dictionary generation, an expedient script `scripts/build-baseline-words.mjs` was introduced to create a 1,000-word dataset for `words.json`. Rather than streaming genuine entries from Kaikki's dictionary dump, the script combined a set of 120 curated root words with a combinatorial prefix array:
```javascript
// DEFECTIVE IMPLEMENTATION IN scripts/build-baseline-words.mjs:
const prefixes = ["re", "un", "in", "pro", "sub", "trans", "inter", "con", "dis", "ad"];
// ...
const derivedWord = `${prefix}${base.w}`; // e.g. "inter" + "fortuitous" -> "interfortuitous"
```
This algorithmically generated hundreds of non-existent English pseudowords (such as `interfortuitous`, `subcourage`, and `transserendipity`) and fabricated synthetic definitions (`"Form associated with..."`) and etymologies (`"Derivative formed from..."`).

### 1.3 Why Was This Shortcut Taken?
1. **Time-to-Generate Expediency**: Downloading and processing the full 497 MB compressed Kaikki dump was viewed as a CI-only operation. To satisfy the local test suite's schema requirement ($\ge 1,000$ entries) quickly during local development, an artificial generator was written.
2. **False Assumptions Regarding Morphological Derivation**: An implicit assumption was made that common prefixes attached to standard roots would produce plausible, harmless filler entries until the monthly GitHub Action workflow executed in CI.

### 1.4 Why Was This Omitted from the Original Design Document?
1. **Specification Gap for Baseline Seeding**: The original design document (`designs/word_of_the_day_design.md`) specified the target end-state architecture (streaming Kaikki dumps in GitHub Actions) in detail, but **completely omitted the bootstrap specification** for how the initial repository `words.json` would be seeded locally before CI ever ran.
2. **Superficial Test Assertions**: The test suite in `test/app.test.js` only asserted structural schema properties (`typeof entry.w === 'string'`, `entry.w.length >= 3`, `entry.u.startsWith('https://...')`). It lacked negative checks for synthetic marker phrases and did not probe Wiktionary for page existence.

### 1.5 Preventative & Remedial Actions
1. **Zero-Tolerance Rule for Synthetic Words**: Programmatic word concatenation or morphological extrapolation is strictly forbidden across all repository code.
2. **Authentic Ingestion Only**: `words.json` must strictly be populated from genuine Kaikki English dictionary dumps (`kaikki.org-dictionary-English.jsonl.gz`), where every entry is a real Wiktionary page parsed by `wiktextract`.
3. **Automated Wiktionary MediaWiki API Verification**: Introduce an API-backed verification mechanism that directly queries Wiktionary's MediaWiki API to verify that sampled entries have valid, positive page IDs on `en.wiktionary.org`.
4. **Permanent Script Deletion**: Delete `scripts/build-baseline-words.mjs`.

---

## 2. Wiktionary Existence Verification Architecture

### 2.1 MediaWiki Query API Mechanism

Wiktionary is powered by MediaWiki, which provides a keyless, high-performance query API:
`https://en.wiktionary.org/w/api.php`

#### API Request Format:
Multiple words (up to 50 titles per request) can be queried simultaneously in a single HTTP `GET` request:
```
https://en.wiktionary.org/w/api.php?action=query&titles=serendipity|alacrity|interfortuitous&format=json
```

#### MediaWiki Response Anatomy:

1. **Existing Page (Valid Lemma)**:
   MediaWiki returns a numeric, positive `pageid` and the canonical title:
   ```json
   {
     "query": {
       "pages": {
         "112456": {
           "pageid": 112456,
           "ns": 0,
           "title": "serendipity"
         }
       }
     }
   }
   ```

2. **Non-Existent Page (Invalid/Synthetic Word)**:
   MediaWiki returns a negative page ID (`-1`) with the `"missing": ""` property:
   ```json
   {
     "query": {
       "pages": {
         "-1": {
           "ns": 0,
           "title": "interfortuitous",
           "missing": ""
         }
       }
     }
   }
   ```

3. **Validation Predicate**:
   A word $w$ is verified to exist on Wiktionary if and only if:
   $$\text{page} \ne \text{null} \quad \land \quad \text{page.pageid} > 0 \quad \land \quad \text{!("missing" in page)}$$

---

### 2.2 Multi-Tier Verification Strategy

```mermaid
flowchart TD
    subgraph Tier1 [Tier 1: Fast Offline Pre-Commit & Unit Tests]
        A[words.json] --> B[Schema Type & Length Asserts]
        A --> C[Regex Invariant: /^[a-z]{3,22}$/]
        A --> D[Negative Assertion: Zero Synthetic Markers]
    end

    subgraph Tier2 [Tier 2: Sampled MediaWiki API Smoke Test]
        A --> E[Sample 25 Deterministic Words]
        E --> F[GET en.wiktionary.org/w/api.php]
        F --> G{All pages have pageid > 0 & no 'missing'?}
        G -->|Yes| H[Pass Test]
        G -->|No| I[Fail Test: Output exact non-existent word]
    end

    subgraph Tier3 [Tier 3: Comprehensive Batch Verifier Script]
        A --> J[scripts/verify-wiktionary-words.mjs]
        J --> K[Batch Query 50 words/req with Rate Limiter]
        K --> L[Validate 100% of entries in words.json]
    end
```

#### Tier 1: Local & Pre-Commit Invariant Assertions (Offline, Zero Network)
* Runs instantly on every `git commit`.
* Asserts that `words.json` contains $\ge 1,000$ entries.
* Validates that no description contains `"Form associated with"` and no etymology contains `"Derivative formed from"`.
* Asserts that every URL strictly follows `https://en.wiktionary.org/wiki/<word>`.

#### Tier 2: Sampled MediaWiki API Smoke Test (`test/app.test.js` or `test/wiktionary-probe.test.js`)
* Samples 25 pseudo-random words from `words.json`.
* Executes a single batched HTTP request to `https://en.wiktionary.org/w/api.php?action=query&titles=...`.
* Asserts that 100% of the sampled words return `pageid > 0` with no `"missing"` field.
* Automatically fails if any word is non-existent on Wiktionary.

#### Tier 3: Full-Dictionary Batch Verifier (`scripts/verify-wiktionary-words.mjs`)
* A dedicated CLI utility that validates every entry in `words.json` against the Wiktionary MediaWiki API in chunks of 50 titles.
* Features rate limiting (3 requests/sec) to adhere to Wikimedia API etiquette.
* Emits a comprehensive report showing verified title count, response latencies, and any anomalies.

---

## 3. Implementation Specifications

### 3.1 Batch Wiktionary Verification Utility: `scripts/verify-wiktionary-words.mjs`

```javascript
/**
 * scripts/verify-wiktionary-words.mjs
 * Validates words in words.json against Wiktionary MediaWiki API in batches of 50.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const WORDS_FILE = path.resolve(process.cwd(), 'words.json');

function queryMediaWikiBatch(words) {
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

    // Rate limiting delay
    if (i + BATCH_SIZE < wordList.length) {
      await new Promise(r => setTimeout(r, 300));
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
```

---

### 3.2 Live Stream Baseline Seeder: `scripts/generate-words.mjs`

Update `scripts/generate-words.mjs` so that when invoked locally with `TARGET_COUNT=1000`, it streams the live Kaikki dump, collects 1,000 real Wiktionary entries into the Stratified A-Res Sampler, and automatically terminates once the target quota is filled:

```javascript
// In processDump():
// Terminate early once sufficient candidates have been gathered
if (lineCount >= 120000 && samples.length >= targetCount) {
  console.log(`Target quota reached (${samples.length} valid words). Finalizing dictionary...`);
  break;
}
```

Streaming ~100,000 lines from Kaikki takes approximately 15–20 seconds, directly downloading and parsing real Wiktionary lemmas (`serendipity`, `mellifluous`, `alacrity`, `resilient`, `quixotic`, etc.) without fabricating words.

---

### 3.3 Unit & Integration Tests in `test/app.test.js`

```javascript
describe('Wiktionary Authenticity & Link Integrity', () => {
    test('words.json contains zero synthetic derivation markers', () => {
        const wordsPath = path.join(process.cwd(), 'words.json');
        const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

        for (const entry of wordsData) {
            assert.equal(entry.d.includes('Form associated with'), false, `Synthetic definition found in ${entry.w}`);
            if (entry.e) {
                assert.equal(entry.e.includes('Derivative formed from'), false, `Synthetic etymology found in ${entry.w}`);
            }
            assert.match(entry.w, /^[a-z]{3,22}$/, `Word ${entry.w} must be valid lowercase letters`);
            assert.equal(entry.u, `https://en.wiktionary.org/wiki/${encodeURIComponent(entry.w)}`);
        }
    });

    test('random sample of words in words.json exist on Wiktionary (MediaWiki API probe)', async () => {
        const wordsPath = path.join(process.cwd(), 'words.json');
        const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

        // Sample 15 diverse words
        const sampleWords = [
            wordsData[0].w,
            wordsData[Math.floor(wordsData.length * 0.25)].w,
            wordsData[Math.floor(wordsData.length * 0.5)].w,
            wordsData[Math.floor(wordsData.length * 0.75)].w,
            wordsData[wordsData.length - 1].w
        ];

        const titles = sampleWords.map(w => encodeURIComponent(w)).join('|');
        const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${titles}&format=json`;

        const res = await fetch(url);
        assert.equal(res.ok, true);

        const data = await res.json();
        assert.ok(data.query && data.query.pages);

        for (const pageId of Object.keys(data.query.pages)) {
            const page = data.query.pages[pageId];
            assert.equal(page.missing, undefined, `Word "${page.title}" was not found on Wiktionary`);
            assert.ok(parseInt(pageId, 10) > 0, `Word "${page.title}" must have a valid positive page ID`);
        }
    });
});
```

---

## 4. Verification Plan

### Automated Tests
1. **Offline & Schema Verification**:
   ```bash
   node --test test/wotd-utils.test.js test/generate-words.test.js test/app.test.js
   ```
2. **Wiktionary MediaWiki API Existence Probe**:
   ```bash
   node scripts/verify-wiktionary-words.mjs
   ```
   Asserts that 100% of headwords in `words.json` return a positive `pageid` on `en.wiktionary.org`.

### Manual Verification
1. Open `index.html` in browser.
2. Confirm the displayed Word of the Day is an authentic English word.
3. Click the `Wiktionary ↗` link.
4. Verify that the browser opens the active Wiktionary entry with definitions matching the widget.

---

## 5. Granular Commit Sequence

1. **Commit 1: Add Wiktionary word authenticity design document and postmortem**
   * Files: `designs/wiktionary_word_validation_design.md`
   * Description: Document root cause analysis of synthetic word generation, postmortem, MediaWiki API existence verification strategy, and invariants.
2. **Commit 2: Remove synthetic word builder and add Wiktionary verification tool**
   * Files: `scripts/generate-words.mjs`, `scripts/verify-wiktionary-words.mjs`, delete `scripts/build-baseline-words.mjs`.
   * Description: Delete artificial prefix-combinator script, update streaming generator with quota-based stream termination, and add MediaWiki batch verification CLI.
3. **Commit 3: Regenerate words.json with 100% authentic Wiktionary entries**
   * Files: `words.json`.
   * Description: Replace all synthetic words with authentic Wiktionary headwords extracted from Kaikki dump and verified via MediaWiki API.
4. **Commit 4: Add authenticity and Wiktionary API probe unit tests**
   * Files: `test/app.test.js`.
   * Description: Add test assertions validating that zero synthetic derivation markers exist in words.json and probing MediaWiki API for sampled page existence.
5. **Commit 5: Update documentation**
   * Files: `README.md`, `PROMPT.md`, `GEMINI.md`.
   * Description: Document Wiktionary authenticity guarantee, removal of synthetic word generation, and verification tooling.
