# Prompt for Batliss

Create a standalone webpage on GitHub Pages that works very similar to https://web.tabliss.io. The webpage should have the following features:

1.  **Background Image**: Include a full-page background image pulled from Unsplash.
2.  **Image Categories**: Allow the image to be pulled based on a predefined set of categories (e.g., "Official Collection", "Nature", "Architecture") or allow the user to provide a few search terms.
3.  **Clock**: Show the current time (on by default) in the user's local timezone in the middle of the page. Use a beautiful font. Allow switching between 12-hour and 24-hour formats, and toggling seconds.
4.  **Custom Message**: Allow the user to specify a custom message to be displayed on the page.
5.  **No Cookies / Persistence**: Do not use cookies or local storage for settings. Use query parameters in the URL for all settings. Generate a permalink that the user can copy to save their setup.
6.  **UI**: The UI should be minimal and elegant. Settings should be accessible but hidden by default (e.g., on hover or via a small icon). Use a glassmorphism effect for UI elements.
7.  **Fallbacks**: Provide fallback images and quotes if external API calls fail.

Tech Stack:
*   Single `index.html` file.
*   Tailwind CSS via CDN for styling.
*   Vanilla JavaScript for logic.
*   Google Fonts for typography.
*   Unsplash API (or public scrape via proxy) for images.
