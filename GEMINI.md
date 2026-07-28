# Gemini Developer Guide - Batliss

## Project Overview

Batliss is a standalone, client-side new-tab dashboard inspired by Tabliss, designed to run on GitHub Pages with zero backend dependencies, no tracking, and URL-driven configuration persistence.

## File Structure

* `index.html`: Primary single-page application (HTML, CSS via Tailwind CDN, Vanilla JS).
* `PROMPT.md`: Core requirements and specification for the Batliss project.
* `README.md`: Public-facing project overview and URL parameter reference.
* `quotes.json`: Offline quotes database for fallback inspiration.
* `manifest.json`: Web App Manifest for PWA support.
* `sw.js`: Service worker handling offline caching.
* `icon-192.png`, `icon-512.png`: App icons.

## Key Technical Conventions

* **State Management**: State is serialized into URL query parameters (`URLSearchParams`). `localStorage` is used as a fallback for PWA launches without query params.
* **Weather & Geocoding Integration**: Open-Meteo API (keyless) for geocoding user-specified locations and current weather forecasts.
* **Styling**: Tailwind CSS CDN + glassmorphism (`backdrop-blur-md`, `bg-black/40`, `border-white/10`).
* **Commit Atomic Documentation**: All markdown documentation updates (`README.md`, `PROMPT.md`, `GEMINI.md`) must be bundled directly into the exact same commit as the code changes they pertain to, rather than committed separately.
