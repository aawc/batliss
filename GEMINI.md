# Gemini Developer Guide - Batliss

## Project Overview

Batliss is a standalone, client-side new-tab dashboard inspired by Tabliss, designed to run on GitHub Pages with zero backend dependencies, no tracking, and URL-driven configuration persistence.

## File Structure

* `index.html`: Primary single-page application (HTML, CSS via Tailwind CDN, Vanilla JS).
* `src/app-core.js`: Pure dashboard logic module (state serialization, weather formatting, greeting calculation).
* `test/app.test.js`: Comprehensive unit test suite (Node.js native test runner `node --test`).
* `designs/`: Technical design and architecture documents for all features and subsystems (e.g., `designs/system_audit_and_hardening_design.md`, `designs/word_of_the_day_design.md`, `designs/wiktionary_word_validation_design.md`, `designs/pwa_state_persistence.md`). All future and existing design documents must reside in this directory.
* `PROMPT.md`: Core requirements and specification for the Batliss project.
* `README.md`: Public-facing project overview and URL parameter reference.
* `package.json`: Project manifest and npm test script configuration.
* `quotes.json`: Curated offline quotes database containing over 500 authentic quotes with source citations.
* `manifest.json`: Web App Manifest for PWA support.
* `sw.js`: Service worker handling offline caching.
* `icon-192.png`, `icon-512.png`: App icons.

## Key Technical Conventions

* **Design Documents in `designs/`**: All architecture and technical design documents must be stored in the `designs/` directory to keep the root directory clean and maintain persistent documentation of system decisions.
* **State Management**: State is serialized into URL query parameters (`URLSearchParams`). `localStorage` is used as a fallback for PWA launches without query params.
* **Weather & Geocoding Integration**: Open-Meteo API (keyless) for geocoding user-specified locations and current weather forecasts. Interactive expand/collapse toggle between compact and detailed hourly forecast strips with in-memory caching (15-min TTL) and keyboard accessibility (Enter/Space).
* **Quotes Database Integrity**: Curated authentic quotes from literature, philosophy, cinema, and historical speeches. Every entry strictly requires non-empty `c` (content), `a` (author), and `s` (source/work) fields, zero normalized duplicates, and a minimum database size of 500 entries.
* **Styling**: Tailwind CSS CDN + glassmorphism (`backdrop-blur-md`, `bg-black/40`, `border-white/10`).
* **Unit Testing, CI & Pre-Commit Enforcement**: Comprehensive unit and integration test suite (`test/app.test.js`) executed before every commit via `.githooks/pre-commit` and gated in CI via `.github/workflows/ci.yml` with coverage thresholds (90% lines, 80% branches).
* **Commit Atomic Documentation**: All markdown documentation updates (`README.md`, `PROMPT.md`, `GEMINI.md`) must be bundled directly into the exact same commit as the code changes they pertain to, rather than committed separately.
