// ==========================================================================
// CredBaba — Agent Portal "Account Disabled" page logic
// Reachable in two ways: (1) redirected here by login.js or
// agent-portal-leads.js after the server reports a non-Approved status, in
// which case a one-time reason flag tailors the message; (2) opened
// directly with no flag present, in which case a sensible default message
// is shown rather than bouncing the visitor away — this page is meant to
// inform, not gate.
// ==========================================================================

(function () {
  const reason = CredBabaAgentPortal.takeDisabledReason();
  const heading = document.getElementById('disabledHeading');
  const message = document.getElementById('disabledMessage');

  if (reason === 'pending') {
    if (heading) heading.textContent = 'Account Pending Approval';
    if (message) message.textContent = 'Your agent account is still awaiting approval. Please contact CredBaba if this is taking longer than expected.';
  } else {
    // 'suspended' and the no-flag default share the same copy — a
    // suspended account and an unknown reason should both point the agent
    // to the same next step: contact CredBaba.
    if (heading) heading.textContent = 'Account Access Disabled';
    if (message) message.textContent = 'Your agent access has been disabled. Please contact CredBaba to resolve this.';
  }
})();
