# Connecting Forms to Google Sheets

CredBaba uses two separate Google Sheets + two separate Google Apps Script
"Web Apps" — one for loan applications, one for agent signups. No backend
server, no cost, fully within Google's free tier.

## Overview

```
[apply.html form] --POST--> [Loan Apps Script URL] --> [CredBaba Loan Leads sheet]
[agent.html form] --POST--> [Agent Apps Script URL] --> [CredBaba Agent Leads sheet]
```

## Step-by-step setup

### 1. Loan Leads sheet + script

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet. Rename it **"CredBaba Loan Leads"**.
2. In row 1, add these exact headers, one per column (A through L):
   ```
   Timestamp | First Name | Last Name | Father Name | DOB | Gender | Mobile | Alt Mobile | PAN | Aadhaar | Loan Types | Required Amount
   ```
3. Go to **Extensions > Apps Script**. A new tab opens with a code editor.
4. Delete the placeholder `function myFunction() {}` code.
5. Open `loan-leads-script.gs` from this folder, copy its entire contents,
   and paste it into the Apps Script editor.
6. Click **Save** (disk icon), then **Deploy > New deployment**.
7. Click the gear icon next to "Select type" and choose **Web app**.
8. Fill in:
   - Description: `CredBaba Loan Leads intake`
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Click **Deploy**. Google will ask you to authorize — click
   **Authorize access**, pick your Google account, then click
   **Advanced** > **Go to CredBaba Loan Leads (unsafe)** > **Allow**.
   (This warning is normal — it's your own script, running only under
   your own account, not shared with anyone.)
10. Copy the **Web app URL** shown (ends in `/exec`). Save it somewhere.

### 2. Agent Leads sheet + script

Repeat the same steps, but:
- Name the sheet **"CredBaba Agent Leads"**
- Headers: `Timestamp | First Name | Last Name | DOB | Gender | Mobile | Alt Mobile | Pincode`
- Paste in `agent-leads-script.gs` instead
- Deployment description: `CredBaba Agent Leads intake`
- Copy this Web app URL separately.

**Note:** `agent-leads-script.gs` also auto-provisions a Pending row in
"CredBaba Agent Credentials" for every new signup (skipping duplicates by
mobile number), so an admin can just review and approve instead of typing
each new agent in by hand. That sheet doesn't exist yet at this point in
the setup — skip pasting a value into `AGENT_CREDENTIALS_SHEET_ID` for now
and come back to it after finishing the "Agent Portal setup" section
below, where that sheet gets created. The signup form still works fine in
the meantime; it just skips the auto-provisioning step until you wire that
ID in (see the note in step 3 of that section).

### 3. Wire the URLs into the website code

1. Open `assets/js/loan-form.js` in the website code. Find this line near
   the top:
   ```js
   const LOAN_FORM_SCRIPT_URL = 'PASTE_YOUR_LOAN_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
   Replace the placeholder string with your Loan Leads Web app URL.

2. Open `assets/js/agent-form.js`. Find:
   ```js
   const AGENT_FORM_SCRIPT_URL = 'PASTE_YOUR_AGENT_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
   Replace with your Agent Leads Web app URL.

3. Commit and push these two files to GitHub (see main README for Git
   steps). GitHub Pages will pick up the change automatically within a
   minute or two.

### 4. Test it

- Open your live site's loan application page, fill in valid test data
  (e.g. a properly formatted fake PAN, a valid-looking mobile number),
  and submit.
- Check the "CredBaba Loan Leads" Google Sheet — a new row should appear
  within a few seconds.
- Repeat for the agent form and "CredBaba Agent Leads" sheet.

### Important notes

- **Updating the script later**: if you ever edit the `.gs` code again,
  you must go to **Deploy > Manage deployments > (pencil/edit icon) >
  New version > Deploy**. Simply saving the script does NOT update the
  live URL.
- **Sheet owner access**: since Apps Script runs "as Me", only you (the
  deploying Google account) can see/edit the underlying sheet by default.
  Share the sheet with teammates via the normal Google Sheets "Share"
  button if others need access.
- **No edit / no login by design**: per the product requirements, this
  intentionally has no way for a user to edit a previous submission —
  they simply submit the form again if details change. Duplicate rows
  are expected behavior in that case, not a bug.
- **Rate limits**: Google Apps Script Web Apps deployed this way have
  generous free quotas (well beyond what a small business site will hit).
  If you ever scale to high volume, revisit this architecture.

## Agent Portal setup (agent login + tagged lead submission)

This is a third, separate Apps Script Web App — for the Agent Portal at
`/agent-portal/`, where logged-in agents submit leads that get tagged to
their agent account automatically. See `agent-portal-plan.md` in the
project root for the full design rationale.

### 1. Create the two Agent Portal sheets

1. Create a new spreadsheet named **"CredBaba Agent Credentials"**. In row
   1, add these exact headers (A through G):
   ```
   Agent ID | Name | Password | Status | Failed Attempts | Locked Until | Mobile
   ```
   This sheet is what you review to approve or suspend agents — see
   "Onboarding an agent" below. Most rows will show up here automatically
   once step 3 is wired up; the Mobile column is what lets the signup form
   avoid creating a duplicate entry for someone who submits twice.
2. Create a second new spreadsheet named **"CredBaba Agent-Sourced
   Leads"**. In row 1, add these exact headers (A through N):
   ```
   Timestamp | Agent ID | Agent Name | First Name | Last Name | Father Name | DOB | Gender | Mobile | Alt Mobile | PAN | Aadhaar | Loan Type | Required Amount
   ```
   Open this sheet's URL and copy the long ID between `/d/` and `/edit` —
   you'll need it in the next step.

### 2. Deploy the script

1. From the **"CredBaba Agent Credentials"** sheet specifically (this
   matters — the script is bound to this sheet), go to
   **Extensions > Apps Script**.
2. Delete the placeholder code and paste in the entire contents of
   `agent-portal-script.gs` from this folder.
3. Near the top, replace `AGENT_LEADS_SHEET_ID`'s placeholder value with
   the Sheet ID you copied in step 1.2 above.
4. Click **Save**, then **Deploy > New deployment**.
5. Gear icon next to "Select type" > **Web app**. Fill in:
   - Description: `CredBaba Agent Portal`
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, authorize when prompted (same "unverified app" flow
   as the other two scripts — safe, it's your own script).
7. Copy the **Web app URL** (ends in `/exec`).

### 3. Wire the URL into the website code

Open both `assets/js/agent-portal-login.js` and
`assets/js/agent-portal-leads.js`. In each, find:
```js
const AGENT_PORTAL_SCRIPT_URL = 'PASTE_YOUR_AGENT_PORTAL_APPS_SCRIPT_WEB_APP_URL_HERE';
```
and replace with the URL from step 2.7. Both files need it — they're two
separate pages hitting the same backend.

**Now go back and finish step 2's note above:** copy this sheet's ID (from
its URL, between `/d/` and `/edit` — same as step 1.2 above) and paste it
into `AGENT_CREDENTIALS_SHEET_ID` near the top of `agent-leads-script.gs`
(the script behind the public "Become an Agent" form). Since you're
editing that script after it's already deployed, redeploy it: **Deploy >
Manage deployments > (pencil icon) > New version > Deploy** — this keeps
the same Web app URL, so nothing needs to change in `agent-form.js`.

### 4. Onboarding an agent

**Most agents need almost no manual work now.** Every submission of the
public "Become an Agent" form (`pages/agent.html`) auto-creates a `Pending`
row here already — Agent ID assigned, password generated, ready to review.
Submitting the same mobile number again doesn't create a second row.

1. Open **"CredBaba Agent Credentials"** and find the new `Pending` row
   (cross-check the Mobile column against "CredBaba Agent Leads" if you
   want more context on who signed up).
2. Change Status to `Approved` and share the already-generated password
   (column C) with them directly (WhatsApp, call, etc). They can change it
   themselves from inside the portal once logged in.

If you ever need to add someone by hand instead (e.g. a legacy agent from
before this existed, or they signed up before you'd wired in
`AGENT_CREDENTIALS_SHEET_ID`):

1. Add a new row with an Agent ID (e.g. `AG-0001`, `AG-0002`, ...) and the
   agent's Name. Leave Password blank. Set Status to `Pending`.
2. Back in the Apps Script editor (still bound to this sheet), select
   `generateMissingPasswords` from the function dropdown at the top and
   click **Run**. This fills in a strong random password for every row
   that's missing one, and defaults blank Status cells to `Pending`.
3. Check **View > Logs** (or **View > Executions**) to confirm how many
   passwords were generated, then read the new password straight off
   column C for the row you just added.
4. Change Status to `Approved` and share the password as above.

**To suspend an agent** (either path), change their Status to `Suspended`.
This takes effect immediately, including mid-session — their very next
lead submission will be rejected and they'll see the account-disabled
page. Re-submitting the public signup form under the same mobile number
afterward won't reactivate them or create a new row — they stay Suspended
until you manually change it back.

### 5. Test it

- Add yourself as a test agent (steps above), open
  `/agent-portal/login.html` on your live site, and log in.
- Submit a test lead with valid-looking data and confirm a new row appears
  in **"CredBaba Agent-Sourced Leads"**, correctly tagged with your Agent
  ID and Name.
- Try logging in with a wrong password a few times in a row and confirm
  you eventually see a lockout message.
- Set that test agent's Status to `Suspended` and confirm both a fresh
  login attempt and (if you're still logged in from before) the next lead
  submission both route you to the "Account Access Disabled" page.
- Try the "Change Password" option on the leads page and confirm you can
  then log out and back in with the new password.
- Submit the public "Become an Agent" form (`pages/agent.html`) with a
  test name and mobile number, and confirm a new `Pending` row appears in
  **"CredBaba Agent Credentials"** with an Agent ID and password already
  filled in.
- Submit that same form again with the identical mobile number and
  confirm a *second* row was **not** created.
- On that same public form, confirm the displayed verification code
  matches what's in `AGENT_SIGNUP_VERIFICATION_CODE` (in
  `assets/js/agent-form.js`), and that entering the wrong code blocks
  submission.
