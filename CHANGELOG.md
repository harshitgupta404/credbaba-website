# Changelog

All notable changes to the CredBaba website are logged here, newest first.
Each entry is dated and grouped as **Added** / **Changed** / **Removed** /
**Fixed**. When you make a change to the site — yourself or via Claude —
add an entry here so the history stays easy to track.

## 2026-08-15 — Auto-provisioned agent credentials + signup anti-spam

Follow-up to the Agent Portal launch below: reduces admin work when
onboarding new agents, and adds a lightweight deterrent against junk
submissions on the public signup form.

### Added
- `apps-script/agent-leads-script.gs` — every public "Become an Agent"
  signup now auto-provisions a `Pending` row in "CredBaba Agent
  Credentials" (new Agent ID assigned via `getNextAgentId()`, a strong
  password already generated), so an admin only has to review and flip
  Status to `Approved` rather than creating the row by hand. Deduped by
  mobile number — a repeat submission from the same number does not
  create a second row, and a `Suspended` agent re-submitting the form
  doesn't get reactivated or issued a fresh row either. Wrapped so a
  problem provisioning credentials never blocks the underlying signup
  from succeeding.
- "CredBaba Agent Credentials" sheet — new **Mobile** column (G), used
  only for the dedup check above and as a cross-reference during review;
  not used for login.
- `pages/agent.html` / `assets/js/agent-form.js` — a visible, rotating
  verification code the visitor must retype before the signup form
  submits. Deliberately client-side only, no backend call: stops casual
  bots that fill in and submit the visible form, but does nothing against
  a script POSTing directly to the Apps Script URL (documented plainly in
  the code as a known limitation, not oversold as real spam protection).
  The code (`AGENT_SIGNUP_VERIFICATION_CODE` in `agent-form.js`) is meant
  to be rotated periodically by editing and redeploying.

### Changed
- `apps-script/agent-portal-script.gs` — setup comments and the
  "ONBOARDING A NEW AGENT" walkthrough updated to describe the
  auto-provisioned flow as the primary path, with manual row creation
  kept as a documented fallback.
- `assets/css/forms.css` — small `.verify-code-display` style for the
  signup form's verification code.
- `apps-script/README.md` — documents the new Mobile column, the
  `AGENT_CREDENTIALS_SHEET_ID` wiring step in `agent-leads-script.gs`
  (including the sheet-creation ordering dependency this introduces), the
  updated onboarding walkthrough, and new test-checklist items for dedup
  and the verification code.

## 2026-08-15 — Agent Portal: login-gated lead entry, tagged for payout

Requested by the business team: agents were keying in customer leads
through the same public loan-application forms customers use, with no way
to record which agent submitted a given lead, making payout attribution
unreliable. Full design rationale in `agent-portal-plan.md`.

### Added
- `agent-portal/login.html`, `leads.html`, `lead-submitted.html`,
  `account-disabled.html` — a new, login-gated section of the site,
  entirely separate from the public loan pages, where approved agents log
  in (session-only, no persistent login) and submit leads through a single
  form (loan type via dropdown, not three separate SEO pages — irrelevant
  for a `noindex`, internal-only tool). Leads submit tagged with the
  agent's ID and name, re-verified server-side on every submission.
- `assets/js/agent-portal-common.js`, `agent-portal-login.js`,
  `agent-portal-leads.js`, `agent-lead-submitted.js`,
  `agent-account-disabled.js` — supporting logic: session storage/guards,
  login, lead-form validation (reuses the existing `validators.js`) +
  change password, and the two confirmation/disabled states.
- `assets/css/agent-portal.css` — session bar, change-password panel, and
  disabled-account page styling; extends rather than duplicates
  `tokens.css`/`site.css`/`forms.css`.
- `apps-script/agent-portal-script.gs` — new Apps Script Web App (bound to
  a new "CredBaba Agent Credentials" sheet) handling `login`,
  `submitLead`, and `changePassword`. Includes failed-login lockout and
  treats a Suspended/Pending account as a distinct outcome from a wrong
  password. Account creation/approval is deliberately NOT reachable
  through this web app — only by editing the Credentials sheet directly or
  running the included `generateMissingPasswords()` utility manually from
  the Apps Script editor, so there's no URL that could mint a new agent
  account. Leads land in a new, separate "CredBaba Agent-Sourced Leads"
  sheet rather than the customer-facing "CredBaba Loan Leads" sheet.
- `agent-portal-plan.md` — the design document this feature was built
  from, kept for reference on the trade-offs made (notably: plaintext
  password in a private, access-restricted sheet — accepted given the
  static-site/no-server constraint and a trusted, known agent base).

### Changed
- `assets/js/form-submit.js` — `submitToAppsScript()` now attaches an
  optional `reason` code to thrown errors when the server provides one
  (backward-compatible; existing callers are unaffected).
- `assets/css/forms.css` — `.field input[type="password"]` added to the
  shared input styling rule (previously only text/tel/date/number/select
  were covered; no existing form used a password field).
- `pages/agent.html` — added an "Already an agent? Log in" link pointing
  to the new portal, just below the signup intro copy.
- `robots.txt` — disallows `/agent-portal/`.
- `README.md`, `apps-script/README.md` — documented the new section, its
  setup steps, and the agent onboarding/suspension workflow.

## 2026-08-15 — Dedicated loan category pages (SEO request)

Requested by the SEO team: split the single loan-application form/URL into
individual SEO-friendly pages per loan type, so each can target its own
keywords, at credbaba.com/home-loan/, /personal-loan/, and /business-loan/.

### Added
- `home-loan/index.html`, `personal-loan/index.html`, `business-loan/index.html`
  — clean-URL (`/loan-type/`) landing + application pages, one per loan
  category, in the same design system as the rest of the site. Content is
  currently the same generic copy as the old form (per explicit instruction),
  just with the loan type substituted into the title/H1/CTA — flagged in
  the README as a follow-up since near-identical pages risk being read as
  thin content by search engines.
- `assets/js/loan-form.js` — shared submit/validation logic for all three
  loan pages. The loan type is fixed per page via a `data-loan-type`
  attribute on the form instead of a multi-select checkbox, so validation
  rules only need to change in one place.
- `sitemap.xml` — lists the homepage, all 3 loan pages, agent, privacy,
  and terms.
- `robots.txt` — allows crawling site-wide, disallows the transactional
  `pages/loan-thank-you.html`, points to `sitemap.xml`.

### Changed
- `pages/apply.html` — converted from the old generic multi-loan-type form
  into a `noindex` redirect stub (meta-refresh + JS) pointing to
  `/business-loan/`, the new default (highest-lead loan type). GitHub Pages
  has no server-side 301 config without Jekyll (disabled here via
  `.nojekyll`), so this client-side redirect is the closest equivalent.
- Header/mobile nav site-wide: replaced the single "Get a Loan" link with
  three flat links — Home Loan, Personal Loan, Business Loan (no dropdown,
  per instruction) — and removed "Become an Agent" from the header
  entirely.
- Footer site-wide: added a "Become an Agent" link (homepage's Explore
  column, and the footer-bottom link cluster on privacy/terms/thank-you)
  so the agent signup page stays reachable from every page now that it's
  out of the header.
- `index.html` — header CTA, hero CTA, and mid-page CTA now point to
  `/business-loan/` instead of `/pages/apply.html`; hero and mid-page CTA
  copy changed to "Apply for Business Loan" to match.
- `README.md` — documented the new loan-page structure, the redirect
  approach and its GitHub Pages limitation, and the nav restructure.

### Removed
- `assets/js/apply-form.js` — dead code, superseded by
  `assets/js/loan-form.js`.

## 2026-08-15 — Loan application Thank You page (SEO request)

Requested by the SEO team: the loan application form redirected users back
to generic content on the same URL after submitting, which gave no proper
confirmation and no distinct URL for conversion tracking.

### Added
- `pages/loan-thank-you.html` — dedicated post-submission Thank You page
  for the loan application form, styled with the existing design system
  (same header/footer, indigo/gold palette, card + success-icon styling
  reused from `forms.css`). Marked `noindex` since it's a transactional
  page, not search content.
- `assets/js/loan-thank-you.js` — renders "Thank You for Your Interest in
  [Loan Type]. Our representative will review your details and get in
  touch with you shortly. We appreciate your interest and look forward to
  assisting you." with the actual selected loan type(s) substituted in.
  Guards direct access: if the page is opened without a fresh submission
  (shared link, bookmark, plain refresh), it redirects to the homepage
  instead of showing the message.

### Changed
- `assets/js/apply-form.js` — on successful submission, now stores the
  selected loan type(s) in a one-time `sessionStorage` flag
  (`cbLoanThankYou`) and redirects to `pages/loan-thank-you.html`, instead
  of toggling an in-page success panel on the same URL. Removed the
  now-unused `formCard` / `successPanel` element references.
- `README.md` — documented the new Thank You flow and added the two new
  files to the project structure tree; added a link to this changelog.

### Removed
- `pages/apply.html` — removed the old generic in-page success panel
  markup ("You're all set." / back-to-home card), superseded by the
  dedicated Thank You page above.
