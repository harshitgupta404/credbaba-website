// ==========================================================================
// CredBaba: Loan application form logic (shared by the dedicated
// Home Loan / Personal Loan / Business Loan pages)
//
// Each loan page's <form> declares its fixed loan type via a
// data-loan-type attribute, e.g.:
//   <form id="loanForm" data-loan-type="Home Loan" novalidate>
// This file is intentionally identical across all three pages so
// validation rules only ever need to change in one place.
// ==========================================================================

// IMPORTANT: Replace this with your deployed Google Apps Script Web App URL
// for the LOAN LEADS sheet. See /apps-script/README.md for setup steps.
const LOAN_FORM_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxnSS5Qhd3L2hr7jLppdVQyVHC7f_Hv9if9lwPiWt5kAT1iViOlOaXA3xo2KH6-acw/exec';

(function () {
  const form = document.getElementById('loanForm');
  const submitBtn = document.getElementById('submitBtn');
  const banner = document.getElementById('formBanner');
  const V = CredBabaValidators;
  const loanType = form.dataset.loanType || 'Loan';

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

  function getLastName() {
    return document.getElementById('lastName').value;
  }

  function getSelectedGender() {
    const el = form.querySelector('input[name="gender"]:checked');
    return el ? el.value : '';
  }

  // ---- Field-level live validation ----
  function validateField(name) {
    switch (name) {
      case 'firstName':
        return setFieldState('f-firstName', V.validateName(document.getElementById('firstName').value, 'First name'));
      case 'lastName':
        return setFieldState('f-lastName', V.validateName(document.getElementById('lastName').value, 'Last name'));
      case 'fatherName':
        return setFieldState('f-fatherName', V.validateName(document.getElementById('fatherName').value, "Father's name"));
      case 'dob':
        return setFieldState('f-dob', V.validateDOB(document.getElementById('dob').value));
      case 'gender':
        return setFieldState('f-gender', V.validateGender(getSelectedGender()));
      case 'mobile':
        return setFieldState('f-mobile', V.validateMobile(document.getElementById('mobile').value, { label: 'Mobile number' }));
      case 'altMobile':
        return setFieldState('f-altMobile', V.validateMobile(document.getElementById('altMobile').value, { optional: true, label: 'Alternate number' }));
      case 'pan':
        return setFieldState('f-pan', V.validatePAN(document.getElementById('pan').value, getLastName()));
      case 'aadhaar':
        return setFieldState('f-aadhaar', V.validateAadhaar(document.getElementById('aadhaar').value));
      case 'amount':
        return setFieldState('f-amount', V.validateRequiredAmount(document.getElementById('amount').value));
      default:
        return true;
    }
  }

  function validateAll() {
    const fields = ['firstName', 'lastName', 'fatherName', 'dob', 'gender', 'mobile', 'altMobile', 'pan', 'aadhaar', 'amount'];
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

  // Live validation on blur + input (input for PAN/mobile uppercase/digit constraints)
  ['firstName', 'lastName', 'fatherName', 'dob', 'pan', 'aadhaar', 'amount'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('blur', () => validateField(id));
  });

  document.getElementById('mobile').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('mobile').addEventListener('blur', () => validateField('mobile'));

  document.getElementById('altMobile').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('altMobile').addEventListener('blur', () => validateField('altMobile'));

  document.getElementById('aadhaar').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 12);
  });

  document.getElementById('amount').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '');
  });

  document.getElementById('pan').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  });

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

    // Re-validate everything on submit, per PRD requirement.
    const isValid = validateAll();
    if (!isValid) {
      showBanner('error', 'Please fix the highlighted fields before submitting.');
      const firstError = form.querySelector('.has-error, #consentError[style*="flex"]');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (LOAN_FORM_SCRIPT_URL.indexOf('PASTE_YOUR') === 0) {
      showBanner('error', 'Form is not yet connected to Google Sheets. See apps-script/README.md.');
      return;
    }

    submitBtn.disabled = true;
    showBanner('loading', 'Submitting your application…');

    const payload = {
      formType: 'loan_application',
      submittedAt: new Date().toISOString(),
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      fatherName: document.getElementById('fatherName').value.trim(),
      dob: document.getElementById('dob').value,
      gender: getSelectedGender(),
      mobile: document.getElementById('mobile').value.trim(),
      altMobile: document.getElementById('altMobile').value.trim(),
      pan: document.getElementById('pan').value.trim().toUpperCase(),
      aadhaar: document.getElementById('aadhaar').value.trim(),
      loanTypes: loanType,
      requiredAmount: document.getElementById('amount').value.trim(),
      consent: true,
    };

    try {
      await submitToAppsScript(LOAN_FORM_SCRIPT_URL, payload);
      // Redirect to the shared Thank You page rather than swapping content
      // in place: a real, trackable conversion URL that survives refresh
      // and can't be reached directly (loan-thank-you.js bounces anyone
      // without a fresh submission flag back to the homepage).
      try {
        sessionStorage.setItem('cbLoanThankYou', JSON.stringify({ loanTypes: [loanType] }));
      } catch (e) { /* storage unavailable, proceed anyway */ }
      window.location.href = '../pages/loan-thank-you.html';
    } catch (err) {
      submitBtn.disabled = false;
      showBanner('error', err.message || 'Something went wrong. Please try again.');
    }
  });
})();
