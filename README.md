# Batliss

A beautiful, standalone new tab page for GitHub Pages, inspired by [Tabliss](https://web.tabliss.io).

## Features

*   **Beautiful Backgrounds**: Pulled from Unsplash based on your preferences.
*   **Clock**: Displays current time in your local timezone.
*   **Location Weather**: Displays current weather, daily summary (High/Low temps, precipitation chance, UV index, wind speed), and hourly forecasts for up to 3 locations (primary location is always auto-inferred via IP).
*   **Wiktionary Word of the Day**: Displays today's featured word, definition, and direct Wiktionary permalink in a glassmorphic top-left badge.
*   **Custom Message**: Set a personal message to display on the page.
*   **No Cookies**: All settings are stored in the URL, allowing for easy sharing and bookmarking via permalinks.
*   **Privacy Focused**: No tracking, no cookies.

## Usage

Simply open `index.html` in your browser. Use the settings icon in the bottom left to customize your experience.

### URL Parameters

You can configure the page by adding query parameters to the URL:

*   `f`: Clock format (`12` or `24`).
*   `s`: Show seconds (`1` for yes, `0` for no).
*   `font`: Font family (e.g., `Inter`, `Playfair Display`, `JetBrains Mono`).
*   `bg`: Background image search terms (comma-separated).
*   `n`: Your name (used in the greeting).
*   `m`: Custom message displayed below the greeting.
*   `cat`: Predefined category for background images.
*   `loc`: Optional primary location override (e.g., `loc=Tokyo`). By default, primary location is auto-inferred via IP.
*   `loc2`: Optional second location (e.g., `loc2=London`).
*   `loc3`: Optional third location (e.g., `loc3=NewYork`).
*   `units`: Temperature scale (`c` for Celsius, `f` for Fahrenheit).
*   `wm`: Weather display mode (`compact` for daily summary, `detailed` for daily summary + hourly forecast strip).
*   `wotd`: Toggle Word of the Day widget (`1` for show, `0` for hide).

Use the "Copy" button in the settings panel to generate a permalink with your current settings.

## Testing

Run unit tests locally via Node.js native test runner:

```bash
node --test test/app.test.js
```

A Git pre-commit hook is configured (`.git/hooks/pre-commit`) to automatically run all unit tests before every commit.
