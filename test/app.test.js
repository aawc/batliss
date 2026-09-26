import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    getWeatherIcon,
    convertCelsiusToFahrenheit,
    formatGreeting,
    parseURLState,
    serializeURLState,
    buildWeatherLocationsList,
    formatHourlyTime,
    resolveBackgroundKeywords,
    parseCoordinateQuery,
    extractDailySummary
} from '../src/app-core.js';

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

    test('returns fog emoji for fog codes 45 and 48', () => {
        assert.equal(getWeatherIcon(45), '🌫️');
        assert.equal(getWeatherIcon(48), '🌫️');
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

    test('formats greeting when name is omitted or empty string', () => {
        assert.equal(formatGreeting(8), 'Good morning.');
        assert.equal(formatGreeting(14, ''), 'Good afternoon.');
        assert.equal(formatGreeting(19, null), 'Good evening.');
        assert.equal(formatGreeting(23, undefined), 'Good night.');
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

    test('parses state with all optional parameters including cat, bg, font, loc, loc3, apiKey, and s=0', () => {
        const query = '?f=24&s=0&font=Playfair&bg=mountains&cat=Nature&n=Bob&m=Peace&loc=Paris&loc2=London&loc3=Rome&units=c&wm=detailed&key=testkey123';
        const parsed = parseURLState(query);

        assert.equal(parsed.format, '24');
        assert.equal(parsed.seconds, false);
        assert.equal(parsed.font, 'Playfair');
        assert.equal(parsed.bg, 'mountains');
        assert.equal(parsed.category, 'Nature');
        assert.equal(parsed.name, 'Bob');
        assert.equal(parsed.message, 'Peace');
        assert.equal(parsed.loc, 'Paris');
        assert.equal(parsed.loc2, 'London');
        assert.equal(parsed.loc3, 'Rome');
        assert.equal(parsed.units, 'c');
        assert.equal(parsed.wMode, 'detailed');
        assert.equal(parsed.apiKey, 'testkey123');
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

    test('serializes state with loc, loc3, apiKey, and handles omitted optional fields', () => {
        const state = {
            format: '24',
            seconds: false,
            font: 'Inter',
            category: 'Featured',
            bg: 'nature',
            name: '',
            message: '',
            loc: 'Berlin',
            loc2: '',
            loc3: 'Madrid',
            units: 'c',
            wMode: 'compact',
            apiKey: 'secret_key_abc'
        };

        const serialized = serializeURLState(state);
        assert.match(serialized, /loc=Berlin/);
        assert.match(serialized, /loc3=Madrid/);
        assert.match(serialized, /key=secret_key_abc/);
        assert.doesNotMatch(serialized, /loc2=/);
        assert.doesNotMatch(serialized, /n=/);
        assert.doesNotMatch(serialized, /m=/);
        assert.doesNotMatch(serialized, /wm=/);
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

    test('returns empty summary when dailyData is null, undefined, or empty object', () => {
        assert.deepEqual(extractDailySummary(null), { highLowText: '', detailsStr: '' });
        assert.deepEqual(extractDailySummary(undefined), { highLowText: '', detailsStr: '' });
        assert.deepEqual(extractDailySummary({}), { highLowText: '', detailsStr: '' });
    });

    test('handles missing precipitation and UV data gracefully in Celsius and Fahrenheit', () => {
        const dailyData = {
            temperature_2m_max: [15],
            temperature_2m_min: [5]
        };
        const summaryC = extractDailySummary(dailyData, 'c');
        assert.equal(summaryC.highLowText, ' (H:15° L:5°)');
        assert.equal(summaryC.detailsStr, '');

        const summaryF = extractDailySummary(dailyData, 'f');
        assert.equal(summaryF.highLowText, ' (H:59° L:41°)');
        assert.equal(summaryF.detailsStr, '');
    });

    test('handles dailyData with empty array fields gracefully', () => {
        const dailyData = {
            temperature_2m_max: [],
            temperature_2m_min: [],
            precipitation_probability_max: [],
            uv_index_max: []
        };
        const summary = extractDailySummary(dailyData, 'c');
        assert.equal(summary.highLowText, '');
        assert.equal(summary.detailsStr, '');
    });
});

describe('Quotes JSON Schema & File Integrity', () => {
    test('loads quotes.json and validates array length, schema fields, and absence of duplicates', () => {
        const quotesPath = path.join(process.cwd(), 'quotes.json');
        assert.equal(fs.existsSync(quotesPath), true);

        const quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
        assert.ok(Array.isArray(quotesData));
        assert.ok(quotesData.length >= 500, `Quotes database should contain at least 500 quotes (found ${quotesData.length})`);

        const seenQuotes = new Set();
        const duplicates = [];

        for (const entry of quotesData) {
            assert.ok(typeof entry.c === 'string' && entry.c.trim().length > 0, 'Quote content must be a non-empty string');
            assert.ok(typeof entry.a === 'string' && entry.a.trim().length > 0, 'Quote author must be a non-empty string');
            assert.ok(typeof entry.s === 'string' && entry.s.trim().length > 0, 'Quote source must be a non-empty string');

            const normalized = entry.c.trim().toLowerCase();
            if (seenQuotes.has(normalized)) {
                duplicates.push(entry.c);
            }
            seenQuotes.add(normalized);
        }

        assert.equal(duplicates.length, 0, `Duplicate quotes found (${duplicates.length}): ${duplicates.slice(0, 5).join(' | ')}`);
    });
});

describe('Service Worker File Integrity', () => {
    test('validates sw.js existence and cache manifest assets', () => {
        const swPath = path.join(process.cwd(), 'sw.js');
        assert.equal(fs.existsSync(swPath), true);

        const swContent = fs.readFileSync(swPath, 'utf8');
        assert.match(swContent, /CACHE_NAME = 'batliss-cache-v5'/);
        assert.match(swContent, /'\.\/index\.html'/);
        assert.match(swContent, /'\.\/src\/app-core\.js'/);
        assert.doesNotMatch(swContent, /words\.json/);
        assert.match(swContent, /'\.\/quotes\.json'/);
        assert.match(swContent, /'\.\/manifest\.json'/);
        assert.match(swContent, /'\.\/icon-192\.png'/);
        assert.match(swContent, /'\.\/icon-512\.png'/);
        assert.match(swContent, /ignoreSearch:\s*true/);
    });
});

describe('Mobile Responsive Layout Integrity', () => {
    test('validates responsive layout classes in index.html for widgets and clock', () => {
        const indexPath = path.join(process.cwd(), 'index.html');
        assert.equal(fs.existsSync(indexPath), true);

        const htmlContent = fs.readFileSync(indexPath, 'utf8');
        assert.match(htmlContent, /justify-end/);
        assert.doesNotMatch(htmlContent, /wotd-widget/);
        assert.doesNotMatch(htmlContent, /set-show-wotd/);
        assert.match(htmlContent, /text-6xl sm:text-7xl md:text-9xl/);
    });

    test('validates UI visibility toggle rules and click listener in index.html', () => {
        const indexPath = path.join(process.cwd(), 'index.html');
        const htmlContent = fs.readFileSync(indexPath, 'utf8');
        assert.match(htmlContent, /\.hidden-ui\s*\{\s*opacity:\s*1/);
        assert.match(htmlContent, /body\.ui-hidden \.hidden-ui/);
        assert.match(htmlContent, /document\.body\.classList\.toggle\('ui-hidden'\)/);
    });
});
