// ==========================================================================
// CredBaba — Form submission helper
// Posts to a Google Apps Script Web App URL. Apps Script Web Apps deployed
// as "Anyone" access don't support custom CORS reading of the response in
// all cases, so we use a no-cors-safe pattern: send as
// 'text/plain' to avoid a CORS preflight, and treat the request as fire-and
// -forget from the browser's perspective, but Apps Script still processes
// and appends the row. We optimistically show success once the request
// completes without a network-level error.
// ==========================================================================

async function submitToAppsScript(scriptUrl, payload) {
  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  // Apps Script web apps respond with a redirect-following JSON body when
  // deployed correctly. We try to parse it, but don't hard-fail the whole
  // submission if parsing isn't possible (opaque response in some CORS modes).
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore, treat as success if no throw */ }
  if (data && data.result === 'error') {
    throw new Error(data.message || 'Submission failed. Please try again.');
  }
  return data;
}
