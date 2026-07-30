/**
 * test/wotd-utils.test.js
 * Comprehensive unit tests for word extraction, A-Res sampling, and PRNG.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPRNG,
  hashString,
  extractCandidateWord,
  StratifiedWeightedSampler,
  getDailyWordFromList
} from '../scripts/wotd-utils.mjs';

describe('PRNG and Hashing Utilities', () => {
  test('generates deterministic pseudorandom sequence from seed', () => {
    const prng1 = createPRNG(12345);
    const prng2 = createPRNG(12345);

    const seq1 = [prng1(), prng1(), prng1()];
    const seq2 = [prng2(), prng2(), prng2()];

    assert.deepEqual(seq1, seq2);
    for (const val of seq1) {
      assert.ok(val >= 0 && val < 1);
    }
  });

  test('creates default seed when 0 or undefined passed', () => {
    const prng = createPRNG(0);
    const val = prng();
    assert.ok(val >= 0 && val < 1);
  });

  test('hashes strings deterministically with FNV-1a', () => {
    const h1 = hashString('2026-07-30');
    const h2 = hashString('2026-07-30');
    const h3 = hashString('2026-07-31');

    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.ok(typeof h1 === 'number' && h1 > 0);
  });
});

describe('Candidate Word Extraction (extractCandidateWord)', () => {
  const mockPath = path.resolve(process.cwd(), 'test/fixtures/kaikki-mock.json');
  const mockEntries = JSON.parse(fs.readFileSync(mockPath, 'utf8'));

  test('extracts valid noun with IPA, definition, and etymology', () => {
    const candidate = extractCandidateWord(mockEntries[0]);
    assert.notEqual(candidate, null);
    assert.equal(candidate.item.w, 'serendipity');
    assert.equal(candidate.item.p, 'noun');
    assert.equal(candidate.item.pr, '/ˌsɛɹənˈdɪpɪti/');
    assert.equal(candidate.item.d, 'The faculty of making fortunate discoveries by accident.');
    assert.equal(candidate.item.e, 'Coined by Horace Walpole in 1754 from Serendip.');
    assert.ok(candidate.weight > 2.0);
  });

  test('extracts valid adjective without etymology', () => {
    const candidate = extractCandidateWord(mockEntries[1]);
    assert.notEqual(candidate, null);
    assert.equal(candidate.item.w, 'resilient');
    assert.equal(candidate.item.p, 'adj');
    assert.equal(candidate.item.pr, '/ɹɪˈzɪl.jənt/');
    assert.equal(candidate.item.e, undefined);
  });

  test('normalizes pos "adverb" to "adv" and "adjective" to "adj"', () => {
    const entryAdv = {
      word: 'swiftly',
      pos: 'adverb',
      lang_code: 'en',
      senses: [{ glosses: ['In a rapid or fast manner.'] }]
    };
    const candAdv = extractCandidateWord(entryAdv);
    assert.notEqual(candAdv, null);
    assert.equal(candAdv.item.p, 'adv');

    const entryAdj = {
      word: 'luminous',
      pos: 'adjective',
      lang_code: 'en',
      senses: [{ glosses: ['Emitting or reflecting steady light.'] }]
    };
    const candAdj = extractCandidateWord(entryAdj);
    assert.notEqual(candAdj, null);
    assert.equal(candAdj.item.p, 'adj');
  });

  test('rejects proper nouns and capitalized words', () => {
    const candidate = extractCandidateWord(mockEntries[2]);
    assert.equal(candidate, null);
  });

  test('rejects inflected forms marked with form-of', () => {
    const candidate = extractCandidateWord(mockEntries[3]);
    assert.equal(candidate, null);
  });

  test('rejects affixes and prefixes', () => {
    const candidate = extractCandidateWord(mockEntries[4]);
    assert.equal(candidate, null);
  });

  test('rejects offensive and vulgar terms', () => {
    const candidate = extractCandidateWord(mockEntries[5]);
    assert.equal(candidate, null);
  });

  test('rejects chemical and specialized taxonomic topics', () => {
    const candidate = extractCandidateWord(mockEntries[6]);
    assert.equal(candidate, null);
  });

  test('rejects non-English dictionary entries', () => {
    const candidate = extractCandidateWord(mockEntries[7]);
    assert.equal(candidate, null);
  });

  test('rejects words shorter than 3 chars or longer than 22 chars', () => {
    const shortWord = {
      word: 'ox',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['A domesticated bovine animal.'] }]
    };
    assert.equal(extractCandidateWord(shortWord), null);

    const longWord = {
      word: 'pneumonoultramicroscopicsilicovolcanoconiosis',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['A lung disease caused by silica dust.'] }]
    };
    assert.equal(extractCandidateWord(longWord), null);
  });

  test('rejects circular redirect definitions (e.g. "Alternative form of...")', () => {
    const redirectEntry = {
      word: 'colour',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['Alternative form of color.'] }]
    };
    assert.equal(extractCandidateWord(redirectEntry), null);
  });

  test('returns null for null, undefined, or non-object entries', () => {
    assert.equal(extractCandidateWord(null), null);
    assert.equal(extractCandidateWord(undefined), null);
    assert.equal(extractCandidateWord({}), null);
    assert.equal(extractCandidateWord('invalid'), null);
  });
});

describe('Stratified A-Res Sampler (StratifiedWeightedSampler)', () => {
  test('respects strata quotas and excludes duplicates across strata', () => {
    const prng = createPRNG(42);
    const sampler = new StratifiedWeightedSampler({ noun: 2, verb: 1, adj: 1, adv: 0 }, prng);

    const candidates = [
      { item: { w: 'apple', p: 'noun', d: 'A round fruit.' }, weight: 1.0 },
      { item: { w: 'banana', p: 'noun', d: 'A yellow fruit.' }, weight: 2.0 },
      { item: { w: 'cherry', p: 'noun', d: 'A small red fruit.' }, weight: 1.5 },
      { item: { w: 'apple', p: 'noun', d: 'Duplicate apple.' }, weight: 3.0 }, // Duplicate
      { item: { w: 'jump', p: 'verb', d: 'To push off the ground.' }, weight: 1.0 },
      { item: { w: 'swift', p: 'adj', d: 'Moving rapidly.' }, weight: 1.0 },
      { item: { w: 'swiftly', p: 'adv', d: 'In a swift manner.' }, weight: 1.0 } // 0 quota
    ];

    for (const c of candidates) {
      sampler.add(c);
    }

    const samples = sampler.getSamples();
    assert.equal(samples.length, 4); // 2 nouns + 1 verb + 1 adj
    const words = samples.map(s => s.w);
    assert.equal(new Set(words).size, 4);
    assert.ok(words.includes('jump'));
    assert.ok(words.includes('swift'));
  });

  test('handles replacing minimum scored item when stratum is full', () => {
    const prng = createPRNG(99);
    const sampler = new StratifiedWeightedSampler({ noun: 2 }, prng);

    for (let i = 0; i < 20; i++) {
      sampler.add({
        item: { w: `word${i}`, p: 'noun', d: `Definition for word ${i}.` },
        weight: (i + 1) * 1.5
      });
    }

    const samples = sampler.getSamples();
    assert.equal(samples.length, 2);
  });
});

describe('Deterministic Daily Word Selection (getDailyWordFromList)', () => {
  const words = [
    { w: 'serendipity', p: 'noun', d: 'Happy accident.' },
    { w: 'ephemeral', p: 'adj', d: 'Lasting a short time.' },
    { w: 'resilient', p: 'adj', d: 'Able to recover.' },
    { w: 'sonder', p: 'noun', d: 'The realization that each passerby has a vivid life.' }
  ];

  test('returns identical word across multiple invocations on the same date', () => {
    const d = new Date('2026-07-30T12:00:00Z');
    const word1 = getDailyWordFromList(words, d);
    const word2 = getDailyWordFromList(words, d);
    assert.deepEqual(word1, word2);
  });

  test('rotates to a different word on subsequent calendar days', () => {
    const d1 = new Date('2026-07-30T00:00:00Z');
    const d2 = new Date('2026-07-31T00:00:00Z');
    const word1 = getDailyWordFromList(words, d1);
    const word2 = getDailyWordFromList(words, d2);
    assert.notDeepEqual(word1, word2);
  });

  test('handles leap year date 2028-02-29 deterministically', () => {
    const leapDate = new Date('2028-02-29T10:00:00Z');
    const word = getDailyWordFromList(words, leapDate);
    assert.ok(words.includes(word));
  });

  test('returns null gracefully on empty or invalid words array', () => {
    assert.equal(getDailyWordFromList([]), null);
    assert.equal(getDailyWordFromList(null), null);
    assert.equal(getDailyWordFromList(undefined), null);
  });
});
