<div align="center">

<img src="public/logo.png" width="128" alt="Sift Logo" />

# Sift

Sift is a DOM-first, privacy-conscious browser extension that helps users sift signal from slop on supported feeds without a backend, accounts, analytics, or hidden scraping.

</div>

## What Sift Does

Sift runs locally in your browser, detects visible posts or articles on supported websites, classifies them against your interests using your own model provider, adds small quality pills, and can optionally hide low-value content.

Supported v1 sites:

1. X / Twitter
2. Reddit
3. Substack

## What DOM-First Means

Sift only inspects content that is already visible in the current tab's DOM. It does not crawl the web in the background, fetch extra pages, or build a server-side feed index.

The extension uses:

1. Site adapters with DOM selectors
2. `MutationObserver` for infinite scroll and SPA updates
3. `IntersectionObserver` for visible-content classification
4. In-memory dedupe and session-only caches

## Why Screenshots Are Not Used

Sift does not use screenshots, OCR, or continuous screen capture in v1. Screenshot pipelines are heavier, harder to audit, and broader than needed for this product. DOM-first extraction is simpler, more transparent, and better aligned with the extension's privacy model.

## BYOK Model

Sift is BYOK only: Bring Your Own Key.

Your API key:

1. Stays inside trusted extension contexts
2. Is never injected into webpage JavaScript
3. Is never sent anywhere except the provider you configure
4. Is session-only by default

If you explicitly enable `Store my preferences on this device`, provider settings and preferences can be stored locally on your machine. Sift still does not persist post text, browsing history, or classification logs.

## What Gets Sent To The Model Provider

When classification is enabled, Sift may send:

1. Your interests and dislikes
2. The supported site name
3. Visible post or article text, capped before sending

This request goes directly from the extension to the provider endpoint you configured.

Important privacy copy:

> Sift does not run a backend and does not store your feed content. When classification is enabled, visible post text may be sent directly from your browser to the model provider you choose using your own API key. The model provider may process that request according to its own API terms.

## What Is Never Stored

Sift does not persist:

1. Post text
2. Classification logs
3. Browsing history
4. Feed snapshots
5. Analytics
6. Telemetry
7. Tracking identifiers

Refresh the page and the current page-session classifications are gone.

## Privacy Statement

> Sift has no backend. It does not collect analytics, does not store your feed, and does not sell data. It classifies only content visible in your browser tab. If you enable cloud model classification, selected visible text is sent directly from your browser extension to the model provider configured by you.

## Architecture

Sift uses Manifest V3 and TypeScript.

Main parts:

1. Background service worker for provider calls and trusted storage
2. Content scripts for DOM detection, pill rendering, and reversible hiding
3. Popup UI for quick controls
4. Options UI for provider setup and privacy settings
5. Modular site adapters for X, Reddit, and Substack

The content script never needs the API key. Classification requests flow like this:

`content script -> runtime message -> background service worker -> model provider -> background -> content script`

## Install Locally

1. Run `npm install`
2. Run `npm run build`
3. Open `chrome://extensions`
4. Enable Developer mode
5. Click `Load unpacked`
6. Select the `dist/` folder
7. Open Sift settings and enter your provider details

## Development

Useful commands:

1. `npm run build`
2. `npm run test`
3. `npm run typecheck`

## Audit Network Requests

To verify Sift only talks to your configured provider:

1. Open a supported site
2. Open DevTools Network
3. Filter by `fetch` or `xhr`
4. Trigger classification
5. Confirm requests only go to your configured provider endpoint

Sift has no project-owned server, analytics endpoint, remote config service, or telemetry collector.

## Add A New Site Adapter

1. Create a new adapter in `src/content/adapters/`
2. Implement `matchesLocation`, `findCandidates`, `extractCandidate`, `getInjectionTarget`, `hideElement`, and `restoreElement`
3. Add the adapter to `src/content/siteRouter.ts`
4. Add HTML fixtures under `tests/fixtures/`
5. Add adapter extraction tests in `tests/adapters.test.ts`
6. Add host permissions and content-script match patterns to `src/manifest.json`

## Report Broken Selectors

If a site changes its DOM and Sift stops finding the right candidates:

1. Open an issue
2. Include the site URL pattern, not private content
3. Describe what stopped working
4. Include relevant DOM snippets or screenshots of the element tree if possible
5. Mention whether you were logged in and which browser version you used

## Privacy Limitations

1. If you use a cloud provider, visible text is still processed under that provider's terms
2. Hashing is used for in-memory dedupe only, not as a privacy guarantee
3. DOM selectors can break when supported sites change their markup
4. This extension only evaluates currently visible supported content, not everything in a feed

## License

MIT. See `LICENSE`.
