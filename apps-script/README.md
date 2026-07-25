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

### 3. Wire the URLs into the website code

1. Open `assets/js/apply-form.js` in the website code. Find this line near
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
