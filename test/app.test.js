import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Core Pure Functions under test (mirroring index.html logic)

export function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if ([1, 2, 3].includes(code)) return '🌤️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
    if ([95, 96, 99].includes(code)) return '🌩️';
    return '🌡️';
}

export function convertCelsiusToFahrenheit(celsius) {
    return (celsius * 9 / 5) + 32;
}

export function formatGreeting(hour, name = '') {
    let greet = 'Good night';
    if (hour < 12) greet = 'Good morning';
    else if (hour < 18) greet = 'Good afternoon';
    else if (hour < 22) greet = 'Good evening';
    return `${greet}${name ? ', ' + name : ''}.`;
}

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
    if (params.has('key')) state.apiKey = params.get('key');

    return state;
}

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
    if (state.apiKey) params.set('key', state.apiKey);

    return params.toString();
}

export function buildWeatherLocationsList(state) {
    return [
        { id: 'primary', query: state.loc ? state.loc.trim() : '' },
        { id: 'loc2', query: state.loc2 ? state.loc2.trim() : '' },
        { id: 'loc3', query: state.loc3 ? state.loc3.trim() : '' }
    ].filter((item, idx) => idx === 0 || item.query !== '');
}

export function formatHourlyTime(hourVal, format = '24') {
    if (format === '12') {
        const h = hourVal % 12 || 12;
        const ampm = hourVal >= 12 ? 'p' : 'a';
        return `${h}${ampm}`;
    }
    return `${hourVal}h`;
}

export function resolveBackgroundKeywords(category, bgQuery) {
    if (category === 'Custom' && bgQuery) return bgQuery;
    if (category && category !== 'Custom') return category.toLowerCase();
    return 'nature,landscape';
}

export function parseCoordinateQuery(query) {
    if (!query) return null;
    const match = query.match(/^([-\d.]+),\s*([-\d.]+)$/);
    if (!match) return null;
    return {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2])
    };
}

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

// Unit Tests Suite

describe('Weather WMO Icon Mapping', () => {
    test('returns sunny emoji for code 0', () => {
        assert.equal(getWeatherIcon(0), '☀️');
    });

    test('returns partly cloudy emoji for codes 1, 2, 3', () => {
        assert.equal(getWeatherIcon(1), '🌤️');
        assert.equal(getWeatherIcon(2), '🌤️');
        assert.equal(getWeatherIcon(3), '🌤️');
    });

    test('returns rain emoji for rain codes', () => {
        assert.equal(getWeatherIcon(61), '🌧️');
        assert.equal(getWeatherIcon(80), '🌧️');
    });

    test('returns snow emoji for snow codes', () => {
        assert.equal(getWeatherIcon(71), '🌨️');
        assert.equal(getWeatherIcon(85), '🌨️');
    });

    test('returns thunderstorm emoji for storm codes', () => {
        assert.equal(getWeatherIcon(95), '🌩️');
        assert.equal(getWeatherIcon(99), '🌩️');
    });

    test('returns thermometer default for unknown code', () => {
        assert.equal(getWeatherIcon(999), '🌡️');
    });
});

describe('Temperature Unit Conversion', () => {
    test('converts 0°C to 32°F', () => {
        assert.equal(convertCelsiusToFahrenheit(0), 32);
    });

    test('converts 20°C to 68°F', () => {
        assert.equal(convertCelsiusToFahrenheit(20), 68);
    });

    test('converts 100°C to 212°F', () => {
        assert.equal(convertCelsiusToFahrenheit(100), 212);
    });
});

describe('Greeting Time Formatting', () => {
    test('returns Good morning for hours < 12', () => {
        assert.equal(formatGreeting(8, 'Alex'), 'Good morning, Alex.');
    });

    test('returns Good afternoon for hours between 12 and 17', () => {
        assert.equal(formatGreeting(14, 'Alex'), 'Good afternoon, Alex.');
    });

    test('returns Good evening for hours between 18 and 21', () => {
        assert.equal(formatGreeting(19, 'Alex'), 'Good evening, Alex.');
    });

    test('returns Good night for hours >= 22', () => {
        assert.equal(formatGreeting(23, 'Alex'), 'Good night, Alex.');
    });
});

describe('URL Search Parameter Parsing & Serialization', () => {
    test('parses state from URL search params correctly', () => {
        const query = '?f=12&s=1&n=Alex&m=Hello&loc2=London&wm=detailed&units=f';
        const parsed = parseURLState(query);

        assert.equal(parsed.format, '12');
        assert.equal(parsed.seconds, true);
        assert.equal(parsed.name, 'Alex');
        assert.equal(parsed.message, 'Hello');
        assert.equal(parsed.loc2, 'London');
        assert.equal(parsed.wMode, 'detailed');
        assert.equal(parsed.units, 'f');
    });

    test('parses legacy w_mode for backward compatibility', () => {
        const query = '?w_mode=detailed';
        const parsed = parseURLState(query);
        assert.equal(parsed.wMode, 'detailed');
    });

    test('serializes state to URL query string using wm parameter', () => {
        const state = {
            format: '12',
            seconds: true,
            font: 'Inter',
            category: 'Featured',
            bg: 'nature',
            name: 'Alex',
            message: 'Inspire',
            loc: '',
            loc2: 'Tokyo',
            loc3: '',
            units: 'f',
            wMode: 'detailed',
            apiKey: ''
        };

        const serialized = serializeURLState(state);
        assert.match(serialized, /f=12/);
        assert.match(serialized, /s=1/);
        assert.match(serialized, /n=Alex/);
        assert.match(serialized, /m=Inspire/);
        assert.match(serialized, /loc2=Tokyo/);
        assert.match(serialized, /units=f/);
        assert.match(serialized, /wm=detailed/);
    });
});

describe('Multi-Location Weather Target List', () => {
    test('always includes primary location even if query is empty', () => {
        const state = { loc: '', loc2: '', loc3: '' };
        const targets = buildWeatherLocationsList(state);
        assert.equal(targets.length, 1);
        assert.equal(targets[0].id, 'primary');
        assert.equal(targets[0].query, '');
    });

    test('includes loc2 and loc3 when provided', () => {
        const state = { loc: '', loc2: 'Paris', loc3: 'Berlin' };
        const targets = buildWeatherLocationsList(state);
        assert.equal(targets.length, 3);
        assert.equal(targets[0].id, 'primary');
        assert.equal(targets[1].query, 'Paris');
        assert.equal(targets[2].query, 'Berlin');
    });
});

describe('Hourly Time Formatting', () => {
    test('formats 24-hour time correctly', () => {
        assert.equal(formatHourlyTime(14, '24'), '14h');
        assert.equal(formatHourlyTime(0, '24'), '0h');
    });

    test('formats 12-hour time correctly with am/pm indicators', () => {
        assert.equal(formatHourlyTime(14, '12'), '2p');
        assert.equal(formatHourlyTime(9, '12'), '9a');
        assert.equal(formatHourlyTime(0, '12'), '12a');
        assert.equal(formatHourlyTime(12, '12'), '12p');
    });
});

describe('Background Keywords Resolution', () => {
    test('returns category in lowercase for predefined categories', () => {
        assert.equal(resolveBackgroundKeywords('Nature', 'architecture'), 'nature');
        assert.equal(resolveBackgroundKeywords('Architecture', ''), 'architecture');
    });

    test('returns custom bgQuery when category is Custom', () => {
        assert.equal(resolveBackgroundKeywords('Custom', 'mountains, mist'), 'mountains, mist');
    });

    test('returns default fallback when category and bgQuery are empty', () => {
        assert.equal(resolveBackgroundKeywords('', ''), 'nature,landscape');
    });
});

describe('Coordinate String Parsing', () => {
    test('parses latitude and longitude from valid coordinate strings', () => {
        const result = parseCoordinateQuery('35.6762, 139.6503');
        assert.notEqual(result, null);
        assert.equal(result.lat, 35.6762);
        assert.equal(result.lon, 139.6503);
    });

    test('returns null for non-coordinate city strings', () => {
        assert.equal(parseCoordinateQuery('Tokyo'), null);
        assert.equal(parseCoordinateQuery('London, UK'), null);
    });
});

describe('Daily Weather Summary Extractor', () => {
    test('formats daily high/low and precipitation details in Celsius', () => {
        const dailyData = {
            temperature_2m_max: [28.6],
            temperature_2m_min: [21.9],
            precipitation_probability_max: [45],
            uv_index_max: [7.8]
        };
        const summary = extractDailySummary(dailyData, 'c');
        assert.equal(summary.highLowText, ' (H:29° L:22°)');
        assert.equal(summary.detailsStr, '🌧️ 45% · UV 8');
    });

    test('converts high/low temps to Fahrenheit when requested', () => {
        const dailyData = {
            temperature_2m_max: [20],
            temperature_2m_min: [10],
            precipitation_probability_max: [10],
            uv_index_max: [5]
        };
        const summary = extractDailySummary(dailyData, 'f');
        assert.equal(summary.highLowText, ' (H:68° L:50°)');
    });
});

describe('Quotes JSON Schema & File Integrity', () => {
    test('loads quotes.json and validates array length and object fields', () => {
        const quotesPath = path.join(process.cwd(), 'quotes.json');
        assert.equal(fs.existsSync(quotesPath), true);

        const quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
        assert.ok(Array.isArray(quotesData));
        assert.ok(quotesData.length >= 200, 'Quotes database should contain at least 200 quotes');

        for (const entry of quotesData) {
            assert.ok(typeof entry.c === 'string' && entry.c.length > 0, 'Quote content must be a non-empty string');
            assert.ok(typeof entry.a === 'string' && entry.a.length > 0, 'Quote author must be a non-empty string');
        }
    });
});

export function parseWotdData(wikitext) {
    if (!wikitext) return { word: '', definition: '' };

    const titleMatch = wikitext.match(/id="WOTD-rss-title">([^<]+)<\/a>/) || wikitext.match(/id="WOTD-rss-title">([^<]+)<\/span>/);
    const word = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = wikitext.match(/id="WOTD-rss-description">(.*?)<\/div>/s);
    let definition = '';
    if (descMatch) {
        let rawDesc = descMatch[1];
        const parts = rawDesc.split('#').map(p => p.trim()).filter(p => p.length > 0);
        let firstDef = parts.length > 0 ? parts[0] : rawDesc;

        definition = firstDef
            .replace(/\[\[Category:[^\]]+\]\]/gi, '')
            .replace(/\[\[File:[^\]]+\]\]/gi, '')
            .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\(\s*\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return { word, definition };
}

describe('Wiktionary Word of the Day Parser', () => {
    test('parses word title and definition from expanded wikitext snippet', () => {
        const sampleWikitext = `
            <span id="WOTD-rss-title">no man's land</span>
            <div id="WOTD-rss-description">
            # The ground between trenches where a soldier from either side would be easily targeted.
            </div>
        `;

        const parsed = parseWotdData(sampleWikitext);
        assert.equal(parsed.word, "no man's land");
        assert.equal(parsed.definition, "The ground between trenches where a soldier from either side would be easily targeted.");
    });

    test('strips category tags, file tags, wiki brackets, and list numbers from raw wikitext', () => {
        const rawWikitext = `
            <span id="WOTD-rss-title">no man's land</span>
            <div id="WOTD-rss-description">
            # ([[military|military]][[Category:en:Military|API]]) The [[ground]] between [[trench]]es where a [[soldier]] from either side would be [[easily]] [[targeted]]. # ([[nautical|nautical]][[Category:en:Nautical|API]]) A [[space]] [[amidships]] used to keep [[block]]s, [[rope]]s, etc.
            </div>
        `;

        const parsed = parseWotdData(rawWikitext);
        assert.equal(parsed.word, "no man's land");
        assert.equal(parsed.definition, "(military) The ground between trenches where a soldier from either side would be easily targeted.");
    });

    test('handles empty or malformed wikitext gracefully', () => {
        const parsed = parseWotdData('');
        assert.equal(parsed.word, '');
        assert.equal(parsed.definition, '');
    });
});

describe('Service Worker File Integrity', () => {
    test('validates sw.js existence and cache manifest assets', () => {
        const swPath = path.join(process.cwd(), 'sw.js');
        assert.equal(fs.existsSync(swPath), true);

        const swContent = fs.readFileSync(swPath, 'utf8');
        assert.match(swContent, /CACHE_NAME = 'batliss-cache-v2'/);
        assert.match(swContent, /'\.\/index\.html'/);
        assert.match(swContent, /'\.\/quotes\.json'/);
        assert.match(swContent, /'\.\/manifest\.json'/);
    });
});

describe('Mobile Responsive Layout Integrity', () => {
    test('validates responsive layout classes in index.html for widgets and clock', () => {
        const indexPath = path.join(process.cwd(), 'index.html');
        assert.equal(fs.existsSync(indexPath), true);

        const htmlContent = fs.readFileSync(indexPath, 'utf8');
        assert.match(htmlContent, /flex flex-col md:flex-row justify-between/);
        assert.match(htmlContent, /text-6xl sm:text-7xl md:text-9xl/);
    });
});
