/**
 * src/app-core.js
 * Single source of truth for pure dashboard logic: state serialization,
 * weather data formatting, greeting calculations, and deterministic PRNG.
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

// Deterministic Daily Word Picker
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

// Weather WMO Code to Emoji Icon
export function getWeatherIcon(code) {
  if (code === 0) return '☀️';
  if ([1, 2, 3].includes(code)) return '🌤️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 99].includes(code)) return '🌩️';
  return '🌡️';
}

// Temperature Conversion
export function convertCelsiusToFahrenheit(celsius) {
  return (celsius * 9 / 5) + 32;
}

// Greeting Formatter
export function formatGreeting(hour, name = '') {
  let greet = 'Good night';
  if (hour < 12) greet = 'Good morning';
  else if (hour < 18) greet = 'Good afternoon';
  else if (hour < 22) greet = 'Good evening';
  return `${greet}${name ? ', ' + name : ''}.`;
}

// URL State Parsing
export function parseURLState(searchString) {
  const params = new URLSearchParams(searchString);
  const state = {
    format: '24',
    seconds: false,
    font: 'Inter',
    category: 'Featured',
    bg: 'nature,landscape',
    name: '',
    message: '',
    loc: '',
    loc2: '',
    loc3: '',
    units: 'c',
    wMode: 'compact',
    wotd: true,
    apiKey: ''
  };

  if (params.has('f')) state.format = params.get('f');
  if (params.has('s')) state.seconds = params.get('s') === '1';
  if (params.has('font')) state.font = params.get('font');
  if (params.has('bg')) state.bg = params.get('bg');
  if (params.has('cat')) state.category = params.get('cat');
  if (params.has('n')) state.name = params.get('n');
  if (params.has('m')) state.message = params.get('m');
  if (params.has('loc')) state.loc = params.get('loc');
  if (params.has('loc2')) state.loc2 = params.get('loc2');
  if (params.has('loc3')) state.loc3 = params.get('loc3');
  if (params.has('units')) state.units = params.get('units');
  if (params.has('wm')) state.wMode = params.get('wm');
  else if (params.has('w_mode')) state.wMode = params.get('w_mode');
  if (params.has('wotd')) state.wotd = params.get('wotd') === '1';
  if (params.has('key')) state.apiKey = params.get('key');

  return state;
}

// URL State Serialization
export function serializeURLState(state) {
  const params = new URLSearchParams();
  params.set('f', state.format);
  params.set('s', state.seconds ? '1' : '0');
  params.set('font', state.font);
  params.set('bg', state.bg);
  params.set('cat', state.category);
  if (state.name) params.set('n', state.name);
  if (state.message) params.set('m', state.message);
  if (state.loc) params.set('loc', state.loc);
  if (state.loc2) params.set('loc2', state.loc2);
  if (state.loc3) params.set('loc3', state.loc3);
  if (state.units && state.units !== 'c') params.set('units', state.units);
  if (state.wMode && state.wMode !== 'compact') params.set('wm', state.wMode);
  if (state.wotd === false) params.set('wotd', '0');
  if (state.apiKey) params.set('key', state.apiKey);

  return params.toString();
}

// Target Locations List Builder
export function buildWeatherLocationsList(state) {
  return [
    { id: 'primary', query: state.loc ? state.loc.trim() : '' },
    { id: 'loc2', query: state.loc2 ? state.loc2.trim() : '' },
    { id: 'loc3', query: state.loc3 ? state.loc3.trim() : '' }
  ].filter((item, idx) => idx === 0 || item.query !== '');
}

// Hourly Time Formatter
export function formatHourlyTime(hourVal, format = '24') {
  if (format === '12') {
    const h = hourVal % 12 || 12;
    const ampm = hourVal >= 12 ? 'p' : 'a';
    return `${h}${ampm}`;
  }
  return `${hourVal}h`;
}

// Background Keywords Resolver
export function resolveBackgroundKeywords(category, bgQuery) {
  if (category === 'Custom' && bgQuery) return bgQuery;
  if (category && category !== 'Custom') return category.toLowerCase();
  return 'nature,landscape';
}

// Coordinate String Parser
export function parseCoordinateQuery(query) {
  if (!query) return null;
  const match = query.match(/^([-\d.]+),\s*([-\d.]+)$/);
  if (!match) return null;
  return {
    lat: parseFloat(match[1]),
    lon: parseFloat(match[2])
  };
}

// Daily Weather Summary Extractor
export function extractDailySummary(dailyData, units = 'c') {
  if (!dailyData) return { highLowText: '', detailsStr: '' };

  let maxTemp = (dailyData.temperature_2m_max && dailyData.temperature_2m_max.length) ? dailyData.temperature_2m_max[0] : null;
  let minTemp = (dailyData.temperature_2m_min && dailyData.temperature_2m_min.length) ? dailyData.temperature_2m_min[0] : null;
  let precip = (dailyData.precipitation_probability_max && dailyData.precipitation_probability_max.length) ? dailyData.precipitation_probability_max[0] : null;
  let uv = (dailyData.uv_index_max && dailyData.uv_index_max.length) ? dailyData.uv_index_max[0] : null;

  if (units === 'f') {
    if (maxTemp !== null) maxTemp = (maxTemp * 9 / 5) + 32;
    if (minTemp !== null) minTemp = (minTemp * 9 / 5) + 32;
  }

  let highLowText = '';
  if (maxTemp !== null && minTemp !== null) {
    highLowText = ` (H:${Math.round(maxTemp)}° L:${Math.round(minTemp)}°)`;
  }

  let detailsParts = [];
  if (precip !== null && precip !== undefined) detailsParts.push(`🌧️ ${precip}%`);
  if (uv !== null && uv !== undefined) detailsParts.push(`UV ${Math.round(uv)}`);

  return {
    highLowText,
    detailsStr: detailsParts.join(' · ')
  };
}
