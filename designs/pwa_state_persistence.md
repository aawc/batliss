# Implementation Plan - Tabliss-like Standalone Webpage (PWA State Persistence)

Fix the issue where PWA does not get the API key and cannot fetch images by using `localStorage` as a fallback when URL parameters are missing.

## Service Worker Caching Architecture (v4)

The Service Worker (`sw.js`) implements a Stale-While-Revalidate caching strategy with the following invariants:
* **Query Parameter Invariance (`ignoreSearch: true`)**: Local app shell navigation requests ignore query string variations (`?f=12...`) when querying the cache, ensuring custom configured permalinks resolve to the cached `index.html` offline.
* **Offline Fallback Resilience**: When the network fails and a resource is cached, `cachedResponse` is returned without triggering unhandled `TypeError` exceptions in `event.respondWith()`.
* **Complete Offline Asset Manifest**: All core assets, data files, and PWA icons (`icon-192.png`, `icon-512.png`) are pre-cached during the `install` event.

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
4.  Disconnect network and load page with query parameters (`/?f=12`) to verify offline rendering without console errors.
