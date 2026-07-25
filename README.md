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
├── pages/
│   ├── apply.html              Loan application form
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
│       ├── validators.js       All PRD validation rules, shared by both forms
│       ├── form-submit.js       Shared Apps Script POST helper
│       ├── apply-form.js       Loan form wiring (validation + submit)
│       └── agent-form.js       Agent form wiring (validation + submit)
├── apps-script/
│   ├── loan-leads-script.gs    Google Apps Script for loan leads sheet
│   ├── agent-leads-script.gs   Google Apps Script for agent leads sheet
│   └── README.md               Step-by-step Sheets + Apps Script setup
├── CNAME                       GitHub Pages custom domain config (credbaba.com)
└── .nojekyll                   Tells GitHub Pages not to run Jekyll processing
```

## Part 1 — Connect the forms to Google Sheets

Follow **`apps-script/README.md`** first. You need two Apps Script Web App
URLs (one per form) pasted into `assets/js/apply-form.js` and
`assets/js/agent-form.js` before the forms will actually save data.

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
