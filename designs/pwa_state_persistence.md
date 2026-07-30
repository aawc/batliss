# Implementation Plan - Tabliss-like Standalone Webpage (PWA State Persistence)

Fix the issue where PWA does not get the API key and cannot fetch images by using `localStorage` as a fallback when URL parameters are missing.

## Proposed Changes

### Frontend

#### [MODIFY] [index.html](file:///usr/local/google/home/vakh/git/hub/aawc/batliss/index.html)

*   **JS**:
    *   Update `loadSettings` to:
        1. Read from URL parameters.
        2. If parameters are found, save them to `localStorage`.
        3. If parameters are NOT found (e.g., when opening PWA from home screen), attempt to load them from `localStorage`.
    *   Update event listeners to also save to `localStorage` when settings change, so the PWA stays updated.

## Verification Plan

### Manual Verification
1.  Open the page with URL parameters (including API key).
2.  Verify settings are saved.
3.  Open the page without parameters (simulate PWA start) and verify it still remembers the settings and API key.
