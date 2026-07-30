/**
 * scripts/wotd-utils.mjs
 * Pure functions for candidate extraction, quality scoring,
 * stratified A-Res reservoir sampling, and deterministic date PRNG.
 */

// Mulberry32 deterministic 32-bit PRNG
export function createPRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit FNV-1a Hash
export function hashString(str) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

const DISALLOWED_TAGS = new Set([
  'offensive', 'vulgar', 'derogatory', 'slur', 'pejorative', 'obscene',
  'abbreviation', 'acronym', 'initialism', 'symbol',
  'form-of', 'inflection-of', 'misspelling', 'obsolete', 'archaic'
]);

const ALLOWED_POS = new Set(['noun', 'verb', 'adj', 'adv']);

const DISALLOWED_TOPICS = new Set([
  'chemistry', 'taxonomic-names', 'organic-chemistry', 'biochemistry', 'genetics'
]);

export function extractCandidateWord(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.lang_code !== 'en' && entry.lang !== 'English') return null;

  const word = entry.word;
  if (!word || typeof word !== 'string') return null;

  const trimmed = word.trim();
  // Valid headwords: 3 to 22 characters, strictly lowercase letters
  if (!/^[a-z]{3,22}$/.test(trimmed)) return null;

  let pos = (entry.pos || '').toLowerCase();
  if (pos === 'adjective') pos = 'adj';
  if (pos === 'adverb') pos = 'adv';
  if (!ALLOWED_POS.has(pos)) return null;

  // Reject inflected forms
  if (entry.forms && Array.isArray(entry.forms)) {
    if (entry.forms.some(f => f.tags && f.tags.includes('form-of'))) return null;
  }

  if (!Array.isArray(entry.senses) || entry.senses.length === 0) return null;

  let bestGloss = null;
  for (const sense of entry.senses) {
    const tags = Array.isArray(sense.tags) ? sense.tags : [];
    const topics = Array.isArray(sense.topics) ? sense.topics : [];

    if (tags.some(t => DISALLOWED_TAGS.has(t.toLowerCase()))) continue;
    if (topics.some(t => DISALLOWED_TOPICS.has(t.toLowerCase()))) continue;
    if (sense.form_of || tags.includes('form-of')) continue;

    const glosses = sense.glosses || sense.raw_glosses || [];
    if (!Array.isArray(glosses) || glosses.length === 0) continue;

    const candidateText = glosses[0].trim();
    if (candidateText.length >= 15 && candidateText.length <= 250) {
      if (!/^(alternative form of|plural of|inflection of|misspelling of|archaic form of)/i.test(candidateText)) {
        bestGloss = candidateText;
        break;
      }
    }
  }

  if (!bestGloss) return null;

  // IPA Pronunciation
  let pron = '';
  if (Array.isArray(entry.sounds)) {
    for (const sound of entry.sounds) {
      if (sound.ipa && typeof sound.ipa === 'string') {
        const cleanIpa = sound.ipa.trim();
        pron = cleanIpa.startsWith('/') ? cleanIpa : `/${cleanIpa}/`;
        break;
      }
    }
  }

  // Etymology
  let etymology = '';
  if (entry.etymology_text && typeof entry.etymology_text === 'string') {
    const cleanEtym = entry.etymology_text.trim();
    if (cleanEtym.length >= 15 && cleanEtym.length <= 280) {
      etymology = cleanEtym;
    }
  }

  // Quality Weighting for A-Res
  let qualityWeight = 1.0;
  if (trimmed.length >= 5 && trimmed.length <= 11) qualityWeight *= 1.5;
  if (etymology) qualityWeight *= 2.5;
  if (pron) qualityWeight *= 1.5;
  qualityWeight *= (1.0 + 0.15 * Math.min(entry.senses.length, 4));

  return {
    item: {
      w: trimmed,
      p: pos,
      d: bestGloss,
      pr: pron || undefined,
      e: etymology || undefined,
      u: `https://en.wiktionary.org/wiki/${encodeURIComponent(trimmed)}`
    },
    weight: qualityWeight
  };
}

/**
 * Stratified A-Res Weighted Reservoir Sampler
 */
export class StratifiedWeightedSampler {
  constructor(strataCapacities, prng = Math.random) {
    this.strataCapacities = strataCapacities;
    this.prng = prng;
    this.reservoirs = new Map();
    this.seenHeadwords = new Set();

    for (const pos of Object.keys(strataCapacities)) {
      this.reservoirs.set(pos, []);
    }
  }

  add(candidate) {
    if (!candidate || !candidate.item) return;
    const { item, weight } = candidate;

    if (this.seenHeadwords.has(item.w)) return;
    this.seenHeadwords.add(item.w);

    const pos = item.p;
    const reservoir = this.reservoirs.get(pos);
    const capacity = this.strataCapacities[pos] || 0;
    if (!reservoir || capacity <= 0) return;

    // A-Res score: r = ln(U) / weight
    const u = Math.max(1e-10, this.prng());
    const score = Math.log(u) / Math.max(0.1, weight);

    if (reservoir.length < capacity) {
      reservoir.push({ score, item });
      if (reservoir.length === capacity) {
        reservoir.sort((a, b) => a.score - b.score);
      }
    } else if (score > reservoir[0].score) {
      reservoir[0] = { score, item };
      reservoir.sort((a, b) => a.score - b.score);
    }
  }

  getSamples() {
    const all = [];
    for (const list of this.reservoirs.values()) {
      for (const entry of list) {
        all.push(entry.item);
      }
    }
    return all.sort((a, b) => a.w.localeCompare(b.w));
  }
}

/**
 * Deterministic Daily Word Picker
 */
export function getDailyWordFromList(wordsList, dateObj = new Date()) {
  if (!Array.isArray(wordsList) || wordsList.length === 0) return null;

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${d}`;

  const dateHash = hashString(dateKey);
  const prng = createPRNG(dateHash);
  const randomIndex = Math.floor(prng() * wordsList.length);

  return wordsList[randomIndex];
}
