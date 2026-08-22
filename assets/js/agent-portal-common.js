// ==========================================================================
// CredBaba: Agent Portal shared helpers
// Session storage, guards, and small utilities shared by every page under
// /agent-portal/. sessionStorage is used deliberately (not localStorage):
// per product decision, an agent's login should not persist once the
// browser session ends, which matters if a device is ever shared.
// ==========================================================================

const CredBabaAgentPortal = (function () {
  const SESSION_KEY = 'cbAgentSession';
  const DISABLED_REASON_KEY = 'cbAgentDisabledReason';
  const LEAD_SUBMITTED_KEY = 'cbAgentLeadSubmitted';

  function getSession() {
    let raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data || !data.agentId || !data.name) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function setSession(agentId, name) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ agentId, name }));
    } catch (e) { /* storage unavailable */ }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // Called right before redirecting to account-disabled.html, so that page
  // can show the right message without needing a URL query param (keeps
  // the reason out of browser history / shareable links).
  function setDisabledReason(reason) {
    try { sessionStorage.setItem(DISABLED_REASON_KEY, reason || 'suspended'); } catch (e) {}
  }

  function takeDisabledReason() {
    let reason = null;
    try {
      reason = sessionStorage.getItem(DISABLED_REASON_KEY);
      sessionStorage.removeItem(DISABLED_REASON_KEY);
    } catch (e) {}
    return reason;
  }

  function setLeadSubmitted(loanType) {
    try {
      sessionStorage.setItem(LEAD_SUBMITTED_KEY, JSON.stringify({ loanType }));
    } catch (e) {}
  }

  function takeLeadSubmitted() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(LEAD_SUBMITTED_KEY);
      sessionStorage.removeItem(LEAD_SUBMITTED_KEY);
    } catch (e) {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // Single choke point for every same-portal redirect this app performs
  // (after the initial <head> guards, which run before this file has even
  // loaded; see the "before paint" comment in leads.html/lead-submitted.html).
  // Routing all of them through one function, rather than scattering
  // window.location.replace(...) calls across every page's script, keeps
  // navigation logic in one place if it ever needs to change. Called as
  // CredBabaAgentPortal.goTo(...) everywhere, including from inside this
  // same module (below), rather than as a bare local reference, so it's
  // one real, single choke point rather than two copies of the same idea.
  function goTo(url) {
    window.location.replace(url);
  }

  // Redirects to the disabled-account page for a given failure reason.
  // Used whenever the server says an agent's status is no longer Approved,
  // whether that's discovered at login or mid-session on a lead submission.
  function goToDisabled(reason) {
    clearSession();
    setDisabledReason(reason);
    CredBabaAgentPortal.goTo('account-disabled.html');
  }

  // Renders "Logged in as X" + wires the Logout button. Expects a session
  // to already be confirmed present (the page-level guard handles that).
  function renderSessionBar(nameElId, logoutBtnId) {
    const session = getSession();
    if (!session) return;
    const nameEl = document.getElementById(nameElId);
    if (nameEl) nameEl.textContent = session.name;
    const logoutBtn = document.getElementById(logoutBtnId);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        clearSession();
        CredBabaAgentPortal.goTo('login.html');
      });
    }
    return session;
  }

  return {
    getSession,
    setSession,
    clearSession,
    setDisabledReason,
    takeDisabledReason,
    setLeadSubmitted,
    takeLeadSubmitted,
    goTo,
    goToDisabled,
    renderSessionBar,
  };
})();
