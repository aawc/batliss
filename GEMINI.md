# Gemini Developer Guide - Batliss

## Project Overview

Batliss is a standalone, client-side new-tab dashboard inspired by Tabliss, designed to run on GitHub Pages with zero backend dependencies, no tracking, and URL-driven configuration persistence.

## File Structure

* `index.html`: Primary single-page application (HTML, CSS via Tailwind CDN, Vanilla JS).
* `test/app.test.js`: Detailed unit test suite (Node.js native test runner `node --test`).
* `designs/`: Technical design and architecture documents for all features and subsystems (e.g., `designs/word_of_the_day_design.md`, `designs/pwa_state_persistence.md`). All future and existing design documents must reside in this directory.
* `scripts/`: Build and dictionary generation scripts executed in CI or development (e.g., `scripts/generate-words.mjs`, `scripts/wotd-utils.mjs`).
* `PROMPT.md`: Core requirements and specification for the Batliss project.
* `README.md`: Public-facing project overview and URL parameter reference.
* `package.json`: Project manifest and npm test script configuration.
* `quotes.json`: Offline quotes database for fallback inspiration.
* `manifest.json`: Web App Manifest for PWA support.
* `sw.js`: Service worker handling offline caching.
* `icon-192.png`, `icon-512.png`: App icons.

## Key Technical Conventions

* **Design Documents in `designs/`**: All architecture and technical design documents must be stored in the `designs/` directory to keep the root directory clean and maintain persistent documentation of system decisions.
* **State Management**: State is serialized into URL query parameters (`URLSearchParams`). `localStorage` is used as a fallback for PWA launches without query params.
* **Weather & Geocoding Integration**: Open-Meteo API (keyless) for geocoding user-specified locations and current weather forecasts.
* **Word of the Day Architecture**: Static dictionary sampled build-time from Kaikki English dumps, committed to `words.json`, and selected deterministically client-side via date hash PRNG.
* **Styling**: Tailwind CSS CDN + glassmorphism (`backdrop-blur-md`, `bg-black/40`, `border-white/10`).
* **Unit Testing & Pre-Commit Enforcement**: Comprehensive unit tests in `test/app.test.js` are executed before every commit via `.git/hooks/pre-commit` using `node --test test/app.test.js`.
* **Commit Atomic Documentation**: All markdown documentation updates (`README.md`, `PROMPT.md`, `GEMINI.md`) must be bundled directly into the exact same commit as the code changes they pertain to, rather than committed separately.
