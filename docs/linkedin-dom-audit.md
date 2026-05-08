# LinkedIn DOM Audit

Development-only helper for inspecting current LinkedIn feed-card structure in DevTools.

Do not ship this script in production.
Do not use it for background crawling.
Do not persist the audit output.

Paste this into DevTools on `linkedin.com/feed/`:

```js
(() => {
  const cards = [
    ...document.querySelectorAll(
      '.feed-shared-update-v2, article.update-components-article, div[data-urn*="urn:li:activity"], div[data-id*="urn:li:activity"]'
    )
  ];

  console.log("Sift LinkedIn DOM audit");
  console.log("Candidate cards:", cards.length);

  cards.slice(0, 10).forEach((card, index) => {
    const buttons = [...card.querySelectorAll("button")].map((btn) => ({
      text: (btn.innerText || "").trim(),
      aria: btn.getAttribute("aria-label"),
      classes: btn.className
    }));

    const links = [...card.querySelectorAll("a[href]")].slice(0, 10).map((a) => ({
      text: (a.innerText || "").trim().slice(0, 80),
      href: a.href
    }));

    console.group(`Card ${index + 1}`);
    console.log("Classes:", card.className);
    console.log("Data urn:", card.getAttribute("data-urn"));
    console.log("Data id:", card.getAttribute("data-id"));
    console.log("Text sample:", (card.innerText || "").slice(0, 500));
    console.table(buttons);
    console.table(links);
    console.groupEnd();
  });
})();
```

Use this to update selectors when LinkedIn changes its DOM.
