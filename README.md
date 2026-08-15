# CredBaba Website

A premium, fast-loading, light/dark-mode website for CredBaba — a DSA
(loan facilitation) brand — with a loan application form and an agent
signup form, both writing to Google Sheets via Google Apps Script.

Built with plain HTML/CSS/JS (no build step, no framework) so it loads
fast even on slow mobile networks, and is hostable for free on GitHub
Pages.

## Project structure

```
credbaba/
├── index.html                 Homepage
├── home-loan/index.html       Home Loan landing + application (credbaba.com/home-loan/)
├── personal-loan/index.html   Personal Loan landing + application (credbaba.com/personal-loan/)
├── business-loan/index.html   Business Loan landing + application (credbaba.com/business-loan/) — default apply target
├── pages/
│   ├── apply.html              Legacy URL — redirect stub → /business-loan/ (kept for old links/bookmarks)
│   ├── loan-thank-you.html     Shared post-submission Thank You page for all 3 loan pages
│   ├── agent.html              Agent signup form
│   ├── privacy.html            Privacy Policy (placeholder legal copy)
│   └── terms.html              Terms of Service (placeholder legal copy)
├── assets/
│   ├── css/
│   │   ├── tokens.css          Design tokens: colors, type, spacing
│   │   ├── site.css            Header, footer, hero, sections
│   │   └── forms.css           Form field & validation styling
│   └── js/
│       ├── theme.js            Light/dark mode toggle
│       ├── validators.js       All PRD validation rules, shared by every form
│       ├── form-submit.js       Shared Apps Script POST helper
│       ├── loan-form.js        Shared logic for all 3 loan pages (reads loan type from a data attribute)
│       ├── agent-form.js       Agent form wiring (validation + submit)
│       └── loan-thank-you.js   Renders/guards the loan Thank You page
├── apps-script/
│   ├── loan-leads-script.gs    Google Apps Script for loan leads sheet
│   ├── agent-leads-script.gs   Google Apps Script for agent leads sheet
│   └── README.md               Step-by-step Sheets + Apps Script setup
├── sitemap.xml                 Lists homepage, 3 loan pages, agent, privacy, terms
├── robots.txt                  Allows crawling, points to sitemap.xml
├── CNAME                       GitHub Pages custom domain config (credbaba.com)
├── CHANGELOG.md                Dated log of every site change
└── .nojekyll                   Tells GitHub Pages not to run Jekyll processing
```

Every change made to this site is logged in **[`CHANGELOG.md`](CHANGELOG.md)** with a
date, so you can always see what changed and when.

## Loan pages (SEO-dedicated URLs)

Each major loan type has its own page/URL instead of one generic form with
a loan-type checkbox:

- `home-loan/index.html` → `https://credbaba.com/home-loan/`
- `personal-loan/index.html` → `https://credbaba.com/personal-loan/`
- `business-loan/index.html` → `https://credbaba.com/business-loan/`
  (the default — homepage CTAs and the legacy `/pages/apply.html` URL
  both point here, since it generates the most leads)

All three share `assets/js/loan-form.js`; the loan type is fixed per page
via `<form id="loanForm" data-loan-type="Home Loan" ...>` rather than a
checkbox, so a lead is always tied to exactly one loan type. The trade-off:
someone interested in more than one loan type submits the form again on
the other page, rather than multi-selecting in one submission.

`pages/apply.html` is kept only as a `noindex` redirect stub (meta-refresh
+ JS) pointing to `/business-loan/`, so any old bookmarks or inbound links
still land somewhere useful. GitHub Pages has no server-side 301 config
(this repo disables Jekyll via `.nojekyll`), so this client-side redirect
is the closest equivalent available without a build step.

The site header/footer nav was restructured to match: the header now
lists Home / Home Loan / Personal Loan / Business Loan (flat links, no
dropdown); "Become an Agent" moved out of the header into the footer on
every page.

## Loan application Thank You flow

None of the loan pages show an in-page success message after submitting.
Instead, on a successful submission, `assets/js/loan-form.js`:

1. Stores the page's loan type in `sessionStorage` under the key
   `cbLoanThankYou` (one-time use).
2. Redirects the browser to `pages/loan-thank-you.html`.

That page (via `assets/js/loan-thank-you.js`) reads the flag, shows
"Thank You for Your Interest in [Loan Type]…", and immediately clears the
flag. If someone opens `loan-thank-you.html` directly — a shared link,
bookmark, or refresh without a fresh submission — there's no flag, so the
script redirects them straight to the homepage instead of showing a Thank
You message for something they never submitted.

This gives the SEO/marketing team a real, dedicated URL
(`/pages/loan-thank-you.html`) to set as a conversion goal in Google
Analytics/Ads, rather than a same-URL content swap that no crawler or
analytics tool can distinguish from the form page itself. The page is
marked `noindex` since it's a transactional destination, not content meant
to rank in search.

## Part 1 — Connect the forms to Google Sheets

Follow **`apps-script/README.md`** first. You need two Apps Script Web App
URLs (one per form) pasted into `assets/js/loan-form.js` (shared by all
three loan pages) and `assets/js/agent-form.js` before the forms will
actually save data.

## Part 2 — Push the code to GitHub

If you don't already have a GitHub account, create one free at
[github.com](https://github.com).

1. Create a new **public** repository, e.g. named `credbaba-website`.
   (Public is required for GitHub Pages on a free personal account.)
2. On your computer, open a terminal in this project folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial CredBaba website"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/credbaba-website.git
   git push -u origin main
   ```
3. On GitHub, go to your repo → **Settings > Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**,
   **Branch: main**, folder **/ (root)**. Click **Save**.
5. Wait 1–2 minutes. GitHub will show a URL like
   `https://YOUR_USERNAME.github.io/credbaba-website/` — confirm the site
   loads there first, before moving to custom domains.

## Part 3 — Connect your GoDaddy domains

You have `credbaba.com` and `credbaba.in`. GitHub Pages supports exactly
**one** custom domain per repository. The clean solution:

- **`credbaba.com`** → primary domain, serves the real site
- **`credbaba.in`** → redirects to `credbaba.com`

### 3a. Set credbaba.com as the primary domain

**On GitHub:**
1. Repo → **Settings > Pages** → under "Custom domain", enter
   `credbaba.com` → **Save**. GitHub will commit a `CNAME` file (already
   included in this repo, so this should auto-detect).
2. Tick **Enforce HTTPS** once it becomes available (can take up to 24
   hours after DNS is set).

**On GoDaddy** (for the `credbaba.com` domain):
1. Log in to GoDaddy → **My Products** → find `credbaba.com` → **DNS**.
2. Add/edit these records (delete conflicting default "Parked" or "Forwarding" records first):

   | Type  | Name | Value                | TTL      |
   |-------|------|-----------------------|----------|
   | A     | @    | 185.199.108.153       | 600 sec  |
   | A     | @    | 185.199.109.153       | 600 sec  |
   | A     | @    | 185.199.110.153       | 600 sec  |
   | A     | @    | 185.199.111.153       | 600 sec  |
   | CNAME | www  | YOUR_USERNAME.github.io | 600 sec |

   (These four A record IPs are GitHub Pages' official IP addresses —
   add all four for redundancy.)
3. Save. DNS changes can take anywhere from a few minutes to a few hours
   to propagate.

### 3b. Redirect credbaba.in to credbaba.com

The simplest free method uses **GoDaddy's built-in domain forwarding**
(no code needed):

1. GoDaddy → **My Products** → find `credbaba.in` → **DNS**.
2. Look for **"Forwarding"** section (not the DNS records table) →
   **Add** or **Manage** under Domain forwarding.
3. Forward to: `https://credbaba.com`
4. Forward type: **Permanent (301)**
5. Settings: **Forward only** (not "Forward with masking" — masking hides
   the destination URL in the browser bar, which looks unprofessional
   and can break bookmarking/SEO).
6. Save.

This means anyone visiting `credbaba.in` in a browser gets redirected to
`credbaba.com` automatically. It's not literally "the same site open on
both domains" at the DNS level, but functionally it achieves your goal:
both domains lead visitors to your live site.

*(Alternative if you specifically need `credbaba.in` to serve content
directly rather than redirect — e.g. for local SEO — that requires a
second, separate GitHub Pages project or a small redirect service, and
is more complex/non-free in most setups. Ask me if you want that route
instead.)*

### 3c. Verify

- Wait for DNS propagation (check anytime at
  [whatsmydns.net](https://www.whatsmydns.net) by entering `credbaba.com`).
- Visit `https://credbaba.com` — should show the CredBaba site.
- Visit `https://credbaba.in` — should redirect to `credbaba.com`.

## Making future changes

Since there's no build step, editing is direct:
1. Edit the relevant `.html`, `.css`, or `.js` file.
2. `git add . && git commit -m "your change" && git push`
3. GitHub Pages redeploys automatically within about a minute.

## Performance notes (why this loads fast on poor networks)

- No JS framework, no build step, no bundler overhead.
- Fonts loaded from Google Fonts CDN with `preconnect` hints; only the
  weights actually used are requested.
- No images — the visual design relies on CSS gradients, SVG icons
  (inlined, no extra HTTP requests), and typography.
- All CSS/JS files are small, cacheable static files served directly by
  GitHub's CDN.
- `prefers-reduced-motion` is respected throughout.

## Still to do before going live

- [ ] Replace the placeholder Privacy Policy and Terms of Service text
      with content reviewed by a lawyer familiar with Indian lending/DSA
      regulations (RBI guidelines, DPDP Act compliance for PAN/Aadhaar
      handling).
- [ ] Replace placeholder contact emails/phone numbers in Privacy/Terms
      pages.
- [ ] Confirm the two Apps Script URLs are live and tested end-to-end.
- [ ] Decide on the credbaba.in strategy (redirect vs. mirrored site).
- [ ] Optional: add a real analytics tool if you want visit tracking
      (keep it privacy-respecting, per the Privacy Policy's claims).
- [ ] The home-loan/personal-loan/business-loan pages currently reuse the
      same generic copy (just the loan type name swapped in) — no unique
      eligibility criteria, required documents, rates/tenure info, or FAQ
      per page yet. Search engines can treat near-identical pages as thin
      content, which undermines the point of splitting them out. Add real,
      distinct content per loan type when it's available.
