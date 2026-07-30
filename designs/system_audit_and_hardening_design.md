# Technical Design Document: System Architecture Audit, Security Hardening & Automation

## 1. Executive Summary

This document formalizes the comprehensive architecture audit, security vulnerabilities, testing fidelity improvements, Service Worker offline resilience, and automation infrastructure across Batliss.

---

## 2. Security Hardening & Privacy Architecture

### 2.1 DOM-Based Cross-Site Scripting (XSS) Mitigation
* **Vulnerability**: Previous implementations in `fetchWeather()` interpolated external API strings (`result.name` from Open-Meteo Geocoding, `city` from IP-lookup services) directly into `itemDiv.innerHTML`.
* **Remediation**:
  - Deprecate all string-interpolated `innerHTML` assignments for dynamic API payloads.
  - Implement imperative DOM node construction (`document.createElement`, `element.textContent`, `element.appendChild`) or strict template node cloning.
  - Render hourly forecast pills through dedicated DOM subtrees with text-only data binding.

### 2.2 Content Security Policy (CSP) & Subresource Integrity
* **Specification**: Introduce an explicit `<meta http-equiv="Content-Security-Policy">` restricting executable script origins and remote connect destinations:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://ipwho.is https://freeipapi.com https://ipapi.co https://api.unsplash.com https://picsum.photos https://images.unsplash.com; object-src 'none';">
  ```

### 2.3 Zero-Permission, Resilient IP-Geolocation Pipeline
* **Design Invariant**: The new-tab experience must never prompt the user with browser permission dialogs (`navigator.geolocation` prompts are forbidden).
* **Multi-Tier Pipeline**:
  1. **Client-Side Cache with 1-Hour TTL**:
     Store inferred coordinates in `localStorage` under `batliss-cached-geo`:
     `{ lat: 37.77, lon: -122.41, name: "San Francisco", timestamp: 1722345600000 }`
     On page load, if `Date.now() - cached.timestamp < 3600000` (1 hour), the cached coordinates are reused immediately without issuing external HTTP requests, preventing rate-limiting on frequent new-tab opens.
  2. **Three-Tier Keyless CORS Cascade**:
     When the cache is missing or expired, query keyless, CORS-enabled IP services in sequence:
     * **Tier 1**: `https://ipwho.is/` (Free, 10,000 requests/month, CORS enabled).
     * **Tier 2**: `https://freeipapi.com/api/json` (Free keyless public CORS endpoint).
     * **Tier 3**: `https://ipapi.co/json/` (Fallback).
  3. **Graceful Degradation**:
     If all tiers fail or the device is offline, weather fails silently without throwing unhandled exceptions or interrupting UI rendering.

---

## 3. Service Worker & PWA Offline Resilience

### 3.1 Query Parameter Invariance (`ignoreSearch: true`)
* **Problem**: W3C Cache API `cache.match(request)` performs an exact string comparison of the full request URL by default (`ignoreSearch: false`). URLs containing query parameters (`?f=12...`) fail cache matching against cached `./` or `./index.html`.
* **Fix**: Pass `{ ignoreSearch: true }` to `cache.match(event.request, { ignoreSearch: true })`.

### 3.2 Offline Cache Miss Error Handling
* **Problem**: When a network fetch rejects and no cached response exists, returning `undefined` from catch blocks causes `event.respondWith()` to throw a fatal `TypeError: The parameter is not a valid Response object`.
* **Fix**: Catch errors and return `cachedResponse` if present; rethrow or return empty responses safely.

### 3.3 Offline Asset Inventory
* Add `./icon-192.png` and `./icon-512.png` to the Service Worker precache list.

---

## 4. Test Suite Fidelity & Single Source of Truth

### 4.1 Modularizing Pure Logic (`src/app-core.js`)
* Extract pure mathematical, parsing, and formatting functions from `index.html` into a shared ES module (`src/app-core.js`):
  - `hashString`, `createPRNG`, `getDailyWordFromList`.
  - `parseURLState`, `serializeURLState`, `formatGreeting`, `getWeatherIcon`, `convertCelsiusToFahrenheit`, `buildWeatherLocationsList`, `formatHourlyTime`, `resolveBackgroundKeywords`, `parseCoordinateQuery`, `extractDailySummary`.
* Both `index.html` (via `<script type="module">`) and `test/app.test.js` import from `src/app-core.js`, eliminating duplicate function maintenance and ensuring unit tests validate production code directly.

### 4.2 Hermetic Unit Testing
* Segregate live network requests (`en.wiktionary.org/w/api.php`) out of `test/app.test.js` and retain them in `scripts/verify-wiktionary-words.mjs`.

---

## 5. Automation & CI/CD Pipeline

### 5.1 CI Workflow (`.github/workflows/ci.yml`)
* Triggers on `push` and `pull_request` against `main`.
* Executes all unit and integration test suites with coverage gates:
  `node --test --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=80 test/app.test.js test/wotd-utils.test.js test/generate-words.test.js`

### 5.2 Monthly Dictionary Pipeline (`.github/workflows/update-words.yml`)
* Sets `TARGET_COUNT: '5000'`.
* Executes `scripts/verify-wiktionary-words.mjs` before committing updated `words.json`.
* Uses pinned, immutable 40-character commit SHAs for all GitHub Actions.

### 5.3 Version-Controlled Git Hooks (`.githooks/pre-commit`)
* Track repository pre-commit hooks under `.githooks/pre-commit` and configure `core.hooksPath` via npm `prepare` script.
