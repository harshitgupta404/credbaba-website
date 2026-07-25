/**
 * CredBaba — Agent Signup Apps Script
 * -----------------------------------------------------------------------
 * SETUP:
 * 1. Create a new Google Sheet named "CredBaba Agent Leads".
 * 2. In row 1, add these exact column headers (in this order):
 *    Timestamp | First Name | Last Name | DOB | Gender | Mobile |
 *    Alt Mobile | Pincode
 * 3. Go to Extensions > Apps Script. Delete any starter code and paste
 *    this entire file in.
 * 4. Click Deploy > New deployment.
 *    - Select type: "Web app"
 *    - Description: "CredBaba Agent Leads intake"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click Deploy. Authorize permissions when prompted (same "unverified
 *    app" flow as the loan script — it's safe, it's your own script).
 * 6. Copy the "Web app URL".
 * 7. Paste that URL into assets/js/agent-form.js, replacing
 *    AGENT_FORM_SCRIPT_URL's placeholder value.
 *
 * NOTE: Whenever you edit this script later, you must create a NEW
 * deployment version for changes to take effect on the existing URL.
 * -----------------------------------------------------------------------
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    if (!data.firstName || !data.lastName || !data.mobile || !data.pincode) {
      return jsonResponse({ result: 'error', message: 'Missing required fields.' });
    }
    if (!/^[6-9]\d{9}$/.test(data.mobile)) {
      return jsonResponse({ result: 'error', message: 'Invalid mobile number.' });
    }
    if (!/^[1-8]\d{5}$/.test(data.pincode)) {
      return jsonResponse({ result: 'error', message: 'Invalid pincode.' });
    }

    sheet.appendRow([
      new Date(),
      data.firstName || '',
      data.lastName || '',
      data.dob || '',
      data.gender || '',
      data.mobile || '',
      data.altMobile || '',
      data.pincode || '',
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
