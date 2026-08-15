// ==========================================================================
// CredBaba — Agent Signup form logic
// ==========================================================================

// IMPORTANT: Replace this with your deployed Google Apps Script Web App URL
// for the AGENT LEADS sheet. See /apps-script/README.md for setup steps.
const AGENT_FORM_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-Rtex5VJixTAP84eZ3bd6lo7quZGGlAhmGF5fvveON6vOXCFIeXiw5lqJAOqUo2w1HA/exec';

// Lightweight, client-side-only anti-spam gate for this public form: the
// code below must match what the visitor types before the form will
// submit. There is deliberately no server involved — this only stops
// casual/naive bots that fill in and submit the visible form; it does
// nothing against a targeted script that POSTs directly to
// AGENT_FORM_SCRIPT_URL, since that bypasses this file entirely. Rotate
// this value periodically (random letters/numbers, any length) and
// redeploy so any scraped/cached code stops working — that's the whole
// defense here, not any single code being "unguessable".
const AGENT_SIGNUP_VERIFICATION_CODE = 'K7QX2M';

(function () {
  const form = document.getElementById('agentForm');
  const submitBtn = document.getElementById('submitBtn');
  const banner = document.getElementById('formBanner');
  const formCard = document.getElementById('formCard');
  const successPanel = document.getElementById('successPanel');
  const V = CredBabaValidators;

  const verifyCodeDisplay = document.getElementById('verifyCodeDisplay');
  if (verifyCodeDisplay) verifyCodeDisplay.textContent = AGENT_SIGNUP_VERIFICATION_CODE;

  function setFieldState(fieldId, result) {
    const field = document.getElementById(fieldId);
    if (!field) return result.valid;
    const errorEl = field.querySelector('.field-error');
    if (result.valid) {
      field.classList.remove('has-error');
      field.classList.add('has-success');
      if (errorEl) errorEl.textContent = '';
    } else {
      field.classList.add('has-error');
      field.classList.remove('has-success');
      if (errorEl) errorEl.textContent = result.message;
    }
    return result.valid;
  }

  function getSelectedGender() {
    const el = form.querySelector('input[name="gender"]:checked');
    return el ? el.value : '';
  }

  function validateField(name) {
    switch (name) {
      case 'firstName':
        return setFieldState('f-firstName', V.validateName(document.getElementById('firstName').value, 'First name'));
      case 'lastName':
        return setFieldState('f-lastName', V.validateName(document.getElementById('lastName').value, 'Last name'));
      case 'dob':
        return setFieldState('f-dob', V.validateDOB(document.getElementById('dob').value));
      case 'gender':
        return setFieldState('f-gender', V.validateGender(getSelectedGender()));
      case 'mobile':
        return setFieldState('f-mobile', V.validateMobile(document.getElementById('mobile').value, { label: 'Mobile number' }));
      case 'altMobile':
        return setFieldState('f-altMobile', V.validateMobile(document.getElementById('altMobile').value, { optional: true, label: 'Alternate number' }));
      case 'pincode':
        return setFieldState('f-pincode', V.validatePincode(document.getElementById('pincode').value));
      case 'verifyCode':
        return validateVerifyCode();
      default:
        return true;
    }
  }

  function validateVerifyCode() {
    const entered = document.getElementById('verifyCode').value.trim().toUpperCase();
    const result = entered === AGENT_SIGNUP_VERIFICATION_CODE
      ? { valid: true, message: '' }
      : { valid: false, message: 'That code doesn\'t match. Please check and try again.' };
    return setFieldState('f-verifyCode', result);
  }

  function validateAll() {
    const fields = ['firstName', 'lastName', 'dob', 'gender', 'mobile', 'altMobile', 'pincode', 'verifyCode'];
    let allValid = true;
    fields.forEach((f) => { if (!validateField(f)) allValid = false; });

    const consentEl = document.getElementById('consent');
    const consentResult = V.validateConsent(consentEl.checked);
    const consentErrorEl = document.getElementById('consentError');
    if (!consentResult.valid) {
      consentErrorEl.style.display = 'flex';
      consentErrorEl.textContent = consentResult.message;
      allValid = false;
    } else {
      consentErrorEl.style.display = 'none';
    }
    return allValid;
  }

  ['firstName', 'lastName', 'dob', 'pincode'].forEach((id) => {
    document.getElementById(id).addEventListener('blur', () => validateField(id));
  });

  document.getElementById('mobile').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('mobile').addEventListener('blur', () => validateField('mobile'));

  document.getElementById('altMobile').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('altMobile').addEventListener('blur', () => validateField('altMobile'));

  document.getElementById('pincode').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
  });

  document.getElementById('verifyCode').addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });
  document.getElementById('verifyCode').addEventListener('blur', () => validateVerifyCode());

  form.querySelectorAll('input[name="gender"]').forEach((el) => {
    el.addEventListener('change', () => validateField('gender'));
  });

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

    const isValid = validateAll();
    if (!isValid) {
      showBanner('error', 'Please fix the highlighted fields before submitting.');
      const firstError = form.querySelector('.has-error, #consentError[style*="flex"]');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (AGENT_FORM_SCRIPT_URL.indexOf('PASTE_YOUR') === 0) {
      showBanner('error', 'Form is not yet connected to Google Sheets. See apps-script/README.md.');
      return;
    }

    submitBtn.disabled = true;
    showBanner('loading', 'Submitting your signup…');

    const payload = {
      formType: 'agent_signup',
      submittedAt: new Date().toISOString(),
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      dob: document.getElementById('dob').value,
      gender: getSelectedGender(),
      mobile: document.getElementById('mobile').value.trim(),
      altMobile: document.getElementById('altMobile').value.trim(),
      pincode: document.getElementById('pincode').value.trim(),
      consent: true,
    };

    try {
      await submitToAppsScript(AGENT_FORM_SCRIPT_URL, payload);
      hideBanner();
      formCard.classList.add('hide');
      successPanel.classList.add('show');
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      submitBtn.disabled = false;
      showBanner('error', err.message || 'Something went wrong. Please try again.');
    }
  });
})();
