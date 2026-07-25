/**
 * CredBaba — Loan Application Apps Script
 * -----------------------------------------------------------------------
 * SETUP:
 * 1. Create a new Google Sheet named "CredBaba Loan Leads".
 * 2. In row 1, add these exact column headers (in this order):
 *    Timestamp | First Name | Last Name | Father Name | DOB | Gender |
 *    Mobile | Alt Mobile | PAN | Aadhaar | Loan Types | Required Amount
 * 3. Go to Extensions > Apps Script. Delete any starter code and paste
 *    this entire file in.
 * 4. Click Deploy > New deployment.
 *    - Select type: "Web app"
 *    - Description: "CredBaba Loan Leads intake"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click Deploy. Authorize the permissions when prompted (you'll see an
 *    "unverified app" warning since this is your own script — click
 *    Advanced > Go to CredBaba Loan Leads (unsafe) > Allow. This is safe
 *    because it's your own script running under your own Google account.
 * 6. Copy the "Web app URL" — it looks like:
 *    https://script.google.com/macros/s/XXXXXXXXXXXX/exec
 * 7. Paste that URL into assets/js/apply-form.js, replacing
 *    LOAN_FORM_SCRIPT_URL's placeholder value.
 *
 * NOTE: Whenever you edit this script later, you must create a NEW
 * deployment version (Deploy > Manage deployments > Edit > New version)
 * for changes to take effect on the existing URL.
 * -----------------------------------------------------------------------
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Basic server-side sanity checks (mirrors client-side validation;
    // never trust the client alone).
    if (!data.firstName || !data.lastName || !data.mobile || !data.pan) {
      return jsonResponse({ result: 'error', message: 'Missing required fields.' });
    }
    if (!/^[6-9]\d{9}$/.test(data.mobile)) {
      return jsonResponse({ result: 'error', message: 'Invalid mobile number.' });
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test((data.pan || '').toUpperCase())) {
      return jsonResponse({ result: 'error', message: 'Invalid PAN format.' });
    }

    sheet.appendRow([
      new Date(),
      data.firstName || '',
      data.lastName || '',
      data.fatherName || '',
      data.dob || '',
      data.gender || '',
      data.mobile || '',
      data.altMobile || '',
      (data.pan || '').toUpperCase(),
      data.aadhaar || '',
      data.loanTypes || '',
      data.requiredAmount || '',
    ]);

    return jsonResponse({ result: 'success' });
  } catch (err) {
    return jsonResponse({ result: 'error', message: 'Server error: ' + err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
