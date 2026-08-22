// ==========================================================================
// CredBaba: Agent Portal "Lead Submitted" page logic
// Mirrors the guard pattern used by the public loan-thank-you.js: this page
// must only ever be reachable right after a real submission, never by
// someone landing on the URL directly. A missing session sends them to
// login.html (handled by the <head> guard already); a missing one-time
// submission flag sends them back to the leads form instead of showing a
// confirmation for something that never happened.
// ==========================================================================

(function () {
  const session = CredBabaAgentPortal.getSession();
  if (!session) {
    CredBabaAgentPortal.goTo('login.html');
    return;
  }
  CredBabaAgentPortal.renderSessionBar('sessionAgentName', 'logoutBtn');

  const submission = CredBabaAgentPortal.takeLeadSubmitted();
  if (!submission || !submission.loanType) {
    CredBabaAgentPortal.goTo('leads.html');
    return;
  }

  const message = document.getElementById('submittedMessage');
  if (message) {
    message.textContent = 'The ' + submission.loanType + ' lead has been recorded and tagged to your agent account.';
  }
})();
