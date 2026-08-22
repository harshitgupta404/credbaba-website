// ==========================================================================
// CredBaba: Validation utilities
// Implements every validation rule from the PRD. Shared by both forms.
// Each validator returns { valid: boolean, message: string }
// ==========================================================================

const CredBabaValidators = (function () {

  const NAME_RE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/; // letters only, allows spaces/hyphens for multi-part names
  const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const VALID_MOBILE_START_RE = /^[6-9][0-9]{9}$/; // starts 6/7/8/9, 10 digits total

  // Obviously-fake patterns to reject outright.
  const FAKE_MOBILE_PATTERNS = [
    /^(\d)\1{9}$/,              // all same digit e.g. 9999999999
    /^0123456789$/,
    /^1234567890$/,
    /^9876543210$/,
    /^0987654321$/,
  ];

  function isSequential(digits) {
    // detects strictly ascending or descending sequences like 1234567890 / 9876543210
    let asc = true, desc = true;
    for (let i = 1; i < digits.length; i++) {
      const prev = Number(digits[i - 1]);
      const cur = Number(digits[i]);
      if (cur !== (prev + 1) % 10) asc = false;
      if (cur !== (prev + 9) % 10) desc = false;
    }
    return asc || desc;
  }

  function validateName(value, fieldLabel) {
    const v = (value || '').trim();
    if (!v) return { valid: false, message: `${fieldLabel} is required.` };
    if (!NAME_RE.test(v)) {
      return { valid: false, message: `${fieldLabel} should contain letters only.` };
    }
    return { valid: true, message: '' };
  }

  function validateMobile(value, { optional = false, label = 'Mobile number' } = {}) {
    const v = (value || '').trim();
    if (!v) {
      if (optional) return { valid: true, message: '' };
      return { valid: false, message: `${label} is required.` };
    }
    if (!/^\d{10}$/.test(v)) {
      return { valid: false, message: `${label} must be exactly 10 digits.` };
    }
    if (!VALID_MOBILE_START_RE.test(v)) {
      return { valid: false, message: `${label} must start with 6, 7, 8, or 9.` };
    }
    if (FAKE_MOBILE_PATTERNS.some((re) => re.test(v)) || isSequential(v)) {
      return { valid: false, message: `Please enter a valid, real ${label.toLowerCase()}.` };
    }
    return { valid: true, message: '' };
  }

  function validateDOB(value, { minAge = 18, maxAge = 100, label = 'Date of birth' } = {}) {
    const v = (value || '').trim();
    if (!v) return { valid: false, message: `${label} is required.` };
    const dob = new Date(v + 'T00:00:00');
    if (isNaN(dob.getTime())) return { valid: false, message: `Enter a valid ${label.toLowerCase()}.` };
    const today = new Date();
    if (dob > today) return { valid: false, message: `${label} cannot be in the future.` };
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < minAge) return { valid: false, message: `You must be at least ${minAge} years old.` };
    if (age > maxAge) return { valid: false, message: `Enter a valid ${label.toLowerCase()}.` };
    return { valid: true, message: '' };
  }

  function validateGender(value) {
    if (!['Male', 'Female', 'Other'].includes(value)) {
      return { valid: false, message: 'Please select a gender.' };
    }
    return { valid: true, message: '' };
  }

  // PAN: AAAAA9999A, 5th character checked against surname/entity initial.
  function validatePAN(value, lastName) {
    const v = (value || '').trim().toUpperCase();
    if (!v) return { valid: false, message: 'PAN number is required.' };
    if (v.length !== 10) return { valid: false, message: 'PAN must be exactly 10 characters.' };
    if (!PAN_RE.test(v)) {
      return { valid: false, message: 'PAN format should be AAAAA9999A (5 letters, 4 digits, 1 letter).' };
    }
    const surname = (lastName || '').trim();
    if (surname) {
      const expectedInitial = surname[0].toUpperCase();
      const panInitial = v[4];
      if (panInitial !== expectedInitial) {
        return {
          valid: false,
          message: `The 5th character of PAN should typically match your last name's first letter (expected "${expectedInitial}").`,
        };
      }
    }
    return { valid: true, message: '' };
  }

  function validateAadhaar(value) {
    const v = (value || '').trim();
    if (!v) return { valid: true, message: '' }; // optional
    if (!/^\d{12}$/.test(v)) {
      return { valid: false, message: 'Aadhaar number must be exactly 12 digits.' };
    }
    return { valid: true, message: '' };
  }

  function validatePincode(value) {
    const v = (value || '').trim();
    if (!v) return { valid: false, message: 'Pincode is required.' };
    if (!/^\d{6}$/.test(v)) return { valid: false, message: 'Pincode must be exactly 6 digits.' };
    const first = v[0];
    if (first === '0') return { valid: false, message: 'Indian PIN codes cannot start with 0.' };
    if (first === '9') return { valid: false, message: 'This PIN code range is currently unused in India.' };
    return { valid: true, message: '' };
  }

  function validateRequiredAmount(value) {
    const v = (value || '').trim();
    if (!v) return { valid: false, message: 'Required amount is required.' };
    if (!/^\d+$/.test(v)) return { valid: false, message: 'Amount must contain digits only.' };
    if (Number(v) <= 0) return { valid: false, message: 'Enter an amount greater than zero.' };
    return { valid: true, message: '' };
  }

  function validateLoanInterest(selected) {
    if (!selected || selected.length === 0) {
      return { valid: false, message: 'Select at least one loan type.' };
    }
    return { valid: true, message: '' };
  }

  function validateConsent(checked) {
    if (!checked) return { valid: false, message: 'Please accept the terms to continue.' };
    return { valid: true, message: '' };
  }

  return {
    validateName,
    validateMobile,
    validateDOB,
    validateGender,
    validatePAN,
    validateAadhaar,
    validatePincode,
    validateRequiredAmount,
    validateLoanInterest,
    validateConsent,
  };
})();
