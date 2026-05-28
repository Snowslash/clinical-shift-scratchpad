# Static project page deployment

This repository now includes a static project page in `docs/` for the Clinical Shift Scratchpad.

Recommended public URL:

```text
scratchpad.sangeev.me
```

## Option A — GitHub Pages

1. Repository settings → Pages.
2. Source: deploy from branch.
3. Branch: `main`.
4. Folder: `/docs`.
5. Custom domain: `scratchpad.sangeev.me`.
6. DNS: create a `CNAME` record for `scratchpad.sangeev.me` pointing to `snowslash.github.io`.

`docs/CNAME` is already present for GitHub Pages.

## Option B — Cloudflare Pages

1. Workers & Pages → Create application → Pages → Connect to Git.
2. Repository: `Snowslash/clinical-shift-scratchpad`.
3. Framework preset: None.
4. Build command: leave blank.
5. Build output directory: `docs`.
6. Add custom domain: `scratchpad.sangeev.me`.

Cloudflare Pages will apply the security headers from `docs/_headers`.
