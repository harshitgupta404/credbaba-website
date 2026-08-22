// ==========================================================================
// CredBaba: Agent Portal login logic
// ==========================================================================

// IMPORTANT: Replace this with your deployed Google Apps Script Web App URL
// for the Agent Portal. See /apps-script/agent-portal-script.gs setup notes.
const AGENT_PORTAL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9NXHd50tTfGblKiSJNAFQIx4wf5GGWskegzFzWCPeZiFLz-g-YVgCrq8TXSLMwDI7/exec';

(function () {
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('submitBtn');
  const banner = document.getElementById('formBanner');
  const agentIdField = document.getElementById('f-agentId');
  const passwordField = document.getElementById('f-password');
  const agentIdInput = document.getElementById('agentId');
  const passwordInput = document.getElementById('password');

  // Already logged in? Skip straight to the leads form.
  if (CredBabaAgentPortal.getSession()) {
    CredBabaAgentPortal.goTo('leads.html');
    return;
  }

  agentIdInput.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });

  function setFieldError(fieldEl, message) {
    const errorEl = fieldEl.querySelector('.field-error');
    if (message) {
      fieldEl.classList.add('has-error');
      if (errorEl) errorEl.textContent = message;
    } else {
      fieldEl.classList.remove('has-error');
      if (errorEl) errorEl.textContent = '';
    }
  }

  function showBanner(type, message) {
    banner.className = 'form-banner show ' + type;
    if (type === 'loading') {
      banner.innerHTML = '<span class="spinner"></span> ' + message;
    } else if (type === 'error') {
      banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> ' + message;
    } else {
      banner.innerHTML = message;
    }
  }
  function hideBanner() {
    banner.className = 'form-banner';
    banner.innerHTML = '';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideBanner();
    setFieldError(agentIdField, '');
    setFieldError(passwordField, '');

    const agentId = agentIdInput.value.trim();
    const password = passwordInput.value;

    let hasError = false;
    if (!agentId) { setFieldError(agentIdField, 'Agent ID is required.'); hasError = true; }
    if (!password) { setFieldError(passwordField, 'Password is required.'); hasError = true; }
    if (hasError) return;

    if (AGENT_PORTAL_SCRIPT_URL.indexOf('PASTE_YOUR') === 0) {
      showBanner('error', 'Agent Portal is not yet connected to Google Sheets. See apps-script/agent-portal-script.gs.');
      return;
    }

    submitBtn.disabled = true;
    showBanner('loading', 'Logging in…');

    try {
      const data = await submitToAppsScript(AGENT_PORTAL_SCRIPT_URL, {
        action: 'login',
        agentId: agentId,
        password: password,
      });
      CredBabaAgentPortal.setSession(data.agentId, data.name);
      CredBabaAgentPortal.goTo('leads.html');
    } catch (err) {
      submitBtn.disabled = false;
      if (err.reason === 'suspended' || err.reason === 'pending') {
        CredBabaAgentPortal.goToDisabled(err.reason);
        return;
      }
      // 'locked' and 'invalid' both stay inline; a lockout is temporary,
      // not the same as a disabled account, and a wrong password is just
      // a wrong password.
      showBanner('error', err.message || 'Something went wrong. Please try again.');
    }
  });
})();
