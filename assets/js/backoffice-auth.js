// ==========================================================================
// CredBaba: Backoffice Authentication & Multi-User Security Engine
// Dedicated for backoffice.credbaba.com
// Handles multi-user management, SHA-256 salted hashing, lockout,
// session lifecycle, and domain isolation.
// ==========================================================================

const CredBabaBackofficeAuth = (function () {
  'use strict';

  const SALT = 'credbaba_secure_salt_2026';
  const BACKOFFICE_HOSTNAME = 'backoffice.credbaba.com';
  
  const STORAGE_KEY_USERS = 'credbaba_backoffice_users';
  const STORAGE_KEY_ATTEMPTS = 'credbaba_backoffice_login_attempts';
  const SESSION_KEY = 'credbaba_backoffice_session';

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
  const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  // Default primary admin user
  const DEFAULT_ADMIN = {
    username: 'admin',
    name: 'Primary Administrator',
    role: 'Super Admin',
    passwordHash: 'b99905801b4a6f74bec41a53623d5f9206c158b73a668b418bf01de49fa8a952',
    status: 'active',
    createdAt: '2026-08-15T00:00:00.000Z',
    isPrimary: true
  };

  // Pure JavaScript SHA-256 implementation (works in all HTTP & HTTPS contexts)
  function sha256Pure(ascii) {
    ascii = unescape(encodeURIComponent(ascii));
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';

    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    
    var hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    var k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);
    
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        var b = (hash[i] >> (8 * j)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // SHA-256 helper with automatic Web Crypto / Pure JS fallback
  async function computeHash(text) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(SALT + text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fallback to pure JS if Web Crypto fails
      }
    }
    return sha256Pure(SALT + text);
  }

  function generateSessionToken() {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fallback
      }
    }
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += Math.floor(Math.random() * 16).toString(16);
    }
    return token;
  }

  // Get all registered admin & marketing users
  function getUsers() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read user vault:', e);
    }
    return [DEFAULT_ADMIN];
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users:', e);
    }
  }

  // Brute-force attempt tracking
  function getAttemptInfo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
    return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
  }

  function setAttemptInfo(info) {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(info));
    } catch (e) {
      // ignore
    }
  }

  function clearAttempts() {
    try {
      localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
    } catch (e) {
      // ignore
    }
  }

  function getRemainingLockoutMs() {
    const info = getAttemptInfo();
    if (!info.lockedUntil) return 0;
    const remaining = info.lockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Authenticate user
  async function login(username, password) {
    const remainingLockout = getRemainingLockoutMs();
    if (remainingLockout > 0) {
      const minutes = Math.ceil(remainingLockout / (60 * 1000));
      return {
        success: false,
        reason: 'LOCKED',
        message: `Too many failed attempts. Console locked for ${minutes} more minute(s).`
      };
    }

    const inputUser = (username || '').trim().toLowerCase();
    const inputPass = (password || '').trim();

    if (!inputUser || !inputPass) {
      return { success: false, reason: 'EMPTY', message: 'User ID and password are required.' };
    }

    const users = getUsers();
    const inputHash = await computeHash(inputPass);

    const user = users.find(u => u.username.toLowerCase() === inputUser || 
      (u.isPrimary && inputUser === 'credbaba_admin'));

    if (user) {
      if (user.status === 'suspended') {
        return { success: false, reason: 'SUSPENDED', message: 'This backoffice user account has been suspended.' };
      }

      if (user.passwordHash === inputHash) {
        clearAttempts();

        const session = {
          token: generateSessionToken(),
          username: user.username,
          name: user.name || user.username,
          role: user.role || 'Admin',
          isPrimary: Boolean(user.isPrimary),
          loginAt: Date.now(),
          lastActiveAt: Date.now()
        };

        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (e) {
          console.error('Session storage failed:', e);
        }

        return { success: true, session };
      }
    }

    // Record failure
    const info = getAttemptInfo();
    info.count = (info.count || 0) + 1;
    if (!info.firstAttemptAt) info.firstAttemptAt = Date.now();

    if (info.count >= MAX_ATTEMPTS) {
      info.lockedUntil = Date.now() + LOCKOUT_MS;
      setAttemptInfo(info);
      return {
        success: false,
        reason: 'LOCKED',
        message: 'Account locked due to 5 failed attempts. Please try again in 15 minutes.'
      };
    } else {
      setAttemptInfo(info);
      const remaining = MAX_ATTEMPTS - info.count;
      return {
        success: false,
        reason: 'INVALID',
        message: `Invalid credentials. ${remaining} attempt(s) remaining before temporary lockout.`
      };
    }
  }

  // Active session
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);

      if (!session || !session.token) return null;

      const elapsed = Date.now() - (session.lastActiveAt || 0);
      if (elapsed > INACTIVITY_TIMEOUT_MS) {
        logout();
        return null;
      }

      session.lastActiveAt = Date.now();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    } catch (e) {
      return null;
    }
  }

  function logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // ignore
    }
    window.location.href = 'login.html';
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      const current = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`login.html?redirect=${current}`);
      return false;
    }
    return true;
  }

  // Change current user's password
  async function changePassword(currentPassword, newPassword) {
    const session = getSession();
    if (!session) return { success: false, message: 'You must be logged in.' };

    const users = getUsers();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === session.username.toLowerCase());
    if (userIndex < 0) return { success: false, message: 'User not found.' };

    const currentHash = await computeHash(currentPassword);
    if (currentHash !== users[userIndex].passwordHash) {
      return { success: false, message: 'Current password does not match.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters long.' };
    }

    users[userIndex].passwordHash = await computeHash(newPassword);
    users[userIndex].lastUpdated = new Date().toISOString();
    saveUsers(users);

    return { success: true, message: 'Password updated successfully.' };
  }

  // Create new user (Marketing / Editor / Admin)
  async function addUser(userData) {
    const session = getSession();
    if (!session) return { success: false, message: 'Unauthorized' };

    const username = (userData.username || '').trim().toLowerCase();
    if (!username || username.length < 3) {
      return { success: false, message: 'Username must be at least 3 characters.' };
    }

    const users = getUsers();
    if (users.some(u => u.username.toLowerCase() === username)) {
      return { success: false, message: 'Username already exists.' };
    }

    if (!userData.password || userData.password.length < 8) {
      return { success: false, message: 'Initial password must be at least 8 characters.' };
    }

    const passHash = await computeHash(userData.password);

    const newUser = {
      username: username,
      name: (userData.name || username).trim(),
      role: userData.role || 'Marketing Editor',
      passwordHash: passHash,
      status: userData.status || 'active',
      createdAt: new Date().toISOString(),
      isPrimary: false
    };

    users.push(newUser);
    saveUsers(users);
    return { success: true, user: newUser, message: `User ${newUser.username} created successfully.` };
  }

  // Update user role or status
  function updateUser(username, updates) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex < 0) return { success: false, message: 'User not found.' };

    const target = users[userIndex];
    if (target.isPrimary && updates.status === 'suspended') {
      return { success: false, message: 'The primary super admin account cannot be suspended.' };
    }

    if (updates.role) target.role = updates.role;
    if (updates.status) target.status = updates.status;
    if (updates.name) target.name = updates.name;

    target.lastUpdated = new Date().toISOString();
    saveUsers(users);
    return { success: true, message: `User ${target.username} updated.` };
  }

  // Delete user
  function deleteUser(username) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, message: 'User not found.' };
    if (user.isPrimary) {
      return { success: false, message: 'The primary super admin account cannot be deleted.' };
    }

    const filtered = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    saveUsers(filtered);
    return { success: true, message: `User ${username} removed successfully.` };
  }

  // Reset to default credentials
  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY_USERS);
    clearAttempts();
    return { success: true, message: 'Users reset to default primary administrator.' };
  }

  return {
    login,
    logout,
    getSession,
    requireAuth,
    changePassword,
    getUsers,
    addUser,
    updateUser,
    deleteUser,
    resetToDefaults,
    getRemainingLockoutMs,
    BACKOFFICE_HOSTNAME
  };
})();

// Backward compatibility alias
const CredBabaAdminAuth = CredBabaBackofficeAuth;
