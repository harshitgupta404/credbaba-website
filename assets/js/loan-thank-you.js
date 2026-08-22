// ==========================================================================
// CredBaba: Loan Thank You page logic
// This page must only ever be reachable as the result of a successful loan
// application submission (see apply-form.js), never by someone landing on
// the URL directly (shared link, bookmark, search result, etc.). We enforce
// that with a one-time sessionStorage flag written right before the
// post-submit redirect: if it's missing, this wasn't a real submission, so
// we bounce the visitor back to the homepage instead of showing a Thank You
// message for something they never did.
// ==========================================================================

(function () {
  var STORAGE_KEY = 'cbLoanThankYou';

  function redirectHome() {
    window.location.replace('../index.html');
  }

  var raw = null;
  try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }

  if (!raw) {
    redirectHome();
    return;
  }

  var data = null;
  try { data = JSON.parse(raw); } catch (e) { /* malformed, treat as missing */ }

  // One-time use: clear immediately so refreshing or revisiting this URL
  // later (without a fresh submission) also redirects home.
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}

  if (!data || !Array.isArray(data.loanTypes) || data.loanTypes.length === 0) {
    redirectHome();
    return;
  }

  function formatLoanTypes(types) {
    if (types.length === 1) return types[0];
    if (types.length === 2) return types[0] + ' & ' + types[1];
    return types.slice(0, -1).join(', ') + ' & ' + types[types.length - 1];
  }

  var loanLabel = formatLoanTypes(data.loanTypes);
  var heading = document.getElementById('thankYouHeading');
  var message = document.getElementById('thankYouMessage');

  if (heading) heading.textContent = 'Thank You for Your Interest in ' + loanLabel;
  if (message) {
    message.textContent = 'Our representative will review your details and get in touch with you shortly. We appreciate your interest and look forward to assisting you.';
  }
  document.title = 'Thank You | CredBaba';
})();
