// ==========================================================================
// CredBaba: Backoffice Authentication & Multi-User Security Engine
// Dedicated for backoffice.credbaba.com
// Handles:
//   1. Multi-user cloud synchronization with Google Sheets
//   2. Role-Based Access Control (Super Admin vs. Marketing Editor / Blog Only)
//   3. SHA-256 salted hashing & brute-force lockout
//   4. Navigation permission rendering & page route guards
// ==========================================================================

const CredBabaBackofficeAuth = (function () {
  'use strict';

  const SALT = 'credbaba_secure_salt_2026';
  const BACKOFFICE_HOSTNAME = 'backoffice.credbaba.com';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBskDFL3qYvO5Xg0i9FEcsGig9JJ3Zl44bYbmnQBc9q_cF_AyflphJSLBs7rlr077Y/exec';
  
  const STORAGE_KEY_USERS = 'credbaba_backoffice_users';
  const STORAGE_KEY_ATTEMPTS = 'credbaba_backoffice_login_attempts';
  const SESSION_KEY = 'credbaba_backoffice_session';

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
  const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  // Role permissions matrix
  const ROLE_PERMISSIONS = {
    'Super Admin': {
      blogs: true,
      editor: true,
      deleteBlogs: true,
      users: true,
      settings: true
    },
    'Content Manager': {
      blogs: true,
      editor: true,
      deleteBlogs: false,
      users: false,
      settings: false
    },
    'Marketing Editor': { // "Only blog permission"
      blogs: true,
      editor: true,
      deleteBlogs: false,
      users: false,
      settings: false
    }
  };

  // Default primary admin user (always available offline)
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

  // SHA-256 helper
  async function computeHash(text) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(SALT + text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
    }
    return sha256Pure(SALT + text);
  }

  function generateSessionToken() {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
    }
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += Math.floor(Math.random() * 16).toString(16);
    }
    return token;
  }

  // Local storage helpers
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
      console.warn('Could not read user cache:', e);
    }
    return [DEFAULT_ADMIN];
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users || []));
    } catch (e) {
      console.error('Failed to save users:', e);
    }
  }

  // Brute-force attempt tracking
  function getAttemptInfo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
  }

  function setAttemptInfo(info) {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(info));
    } catch (e) {}
  }

  function clearAttempts() {
    try {
      localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
    } catch (e) {}
  }

  function getRemainingLockoutMs() {
    const info = getAttemptInfo();
    if (!info.lockedUntil) return 0;
    const remaining = info.lockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Authenticate user against Google Sheet Cloud Database (with local fallback)
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

    const inputHash = await computeHash(inputPass);

    // 1. Check local Primary Super Admin (instant offline fallback)
    if ((inputUser === 'admin' || inputUser === 'credbaba_admin') && inputHash === DEFAULT_ADMIN.passwordHash) {
      clearAttempts();
      const session = {
        token: generateSessionToken(),
        username: 'admin',
        name: 'Primary Administrator',
        role: 'Super Admin',
        isPrimary: true,
        loginAt: Date.now(),
        lastActiveAt: Date.now()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { success: true, session };
    }

    // 2. Authenticate against central Google Apps Script Web App
    try {
      const scriptUrl = getAppsScriptUrl();
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'authenticate',
          username: inputUser,
          passwordHash: inputHash
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.result === 'success' && data.user) {
          clearAttempts();
          const session = {
            token: generateSessionToken(),
            username: data.user.username,
            name: data.user.name || data.user.username,
            role: data.user.role || 'Marketing Editor',
            isPrimary: Boolean(data.user.isPrimary),
            loginAt: Date.now(),
            lastActiveAt: Date.now()
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

          // Cache user credentials locally on this machine
          try {
            const currentUsers = getUsers();
            const existingIdx = currentUsers.findIndex(u => u.username.toLowerCase() === data.user.username.toLowerCase());
            const userRecord = {
              username: data.user.username,
              name: data.user.name || data.user.username,
              role: data.user.role || 'Marketing Editor',
              passwordHash: inputHash,
              status: data.user.status || 'active',
              isPrimary: Boolean(data.user.isPrimary)
            };
            if (existingIdx >= 0) {
              currentUsers[existingIdx] = userRecord;
            } else {
              currentUsers.push(userRecord);
            }
            saveUsers(currentUsers);
          } catch (e) {}

          return { success: true, session };
        }
        if (data && data.reason === 'SUSPENDED') {
          return { success: false, reason: 'SUSPENDED', message: 'This user account has been suspended.' };
        }
      }
    } catch (netErr) {
      console.warn('Apps Script authentication error, falling back to local vault:', netErr);
    }

    // 3. Fallback: check cached users locally
    const cachedUsers = getUsers();
    const localMatch = cachedUsers.find(u => u.username.toLowerCase() === inputUser);
    if (localMatch) {
      if (localMatch.status === 'suspended') {
        return { success: false, reason: 'SUSPENDED', message: 'This user account has been suspended.' };
      }
      if (localMatch.passwordHash === inputHash) {
        clearAttempts();
        const session = {
          token: generateSessionToken(),
          username: localMatch.username,
          name: localMatch.name || localMatch.username,
          role: localMatch.role || 'Marketing Editor',
          isPrimary: Boolean(localMatch.isPrimary),
          loginAt: Date.now(),
          lastActiveAt: Date.now()
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, session };
      }
    }

    // Record failure attempt
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
    } catch (e) {}
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

  // ========================================================================
  // ROLE-BASED ACCESS CONTROL (RBAC)
  // ========================================================================
  function hasPermission(permissionKey) {
    const session = getSession();
    if (!session) return false;
    const role = session.role || 'Marketing Editor';
    if (role === 'Super Admin' || session.isPrimary) return true;
    const perms = ROLE_PERMISSIONS[role];
    return Boolean(perms && perms[permissionKey]);
  }

  function canManageUsers() {
    return hasPermission('users');
  }

  function canManageSettings() {
    return hasPermission('settings');
  }

  function canDeleteBlogs() {
    return hasPermission('deleteBlogs');
  }

  // Enforces page-level route security
  function enforcePageAccess(requiredPermission) {
    if (!requireAuth()) return false;
    if (requiredPermission && !hasPermission(requiredPermission)) {
      alert('Access Denied: You do not have permission to access this section.');
      window.location.replace('blogs.html');
      return false;
    }
    return true;
  }

  // Dynamic Apps Script URL lookup (settings override or hardcoded default)
  function getAppsScriptUrl() {
    let url = APPS_SCRIPT_URL;
    try {
      const raw = localStorage.getItem('credbaba_backoffice_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.appsScriptUrl && parsed.appsScriptUrl.trim()) {
          url = parsed.appsScriptUrl.trim();
        }
      }
    } catch (e) {}
    return url;
  }

  // Automatically cleans navbar based on user role
  function initNav() {
    const session = getSession();
    if (!session) return;

    const usernameEl = document.getElementById('sessionUsername');
    const roleEl = document.getElementById('sessionRole');
    if (usernameEl) usernameEl.textContent = session.name || session.username;
    if (roleEl) roleEl.textContent = `(${session.role || 'Admin'})`;

    const isSuper = session.role === 'Super Admin' || session.isPrimary;

    // Remove restricted links from DOM for non-super-admins
    document.querySelectorAll('[data-perm="users"]').forEach(el => {
      if (!isSuper && !canManageUsers()) el.remove();
    });
    document.querySelectorAll('[data-perm="settings"]').forEach(el => {
      if (!isSuper && !canManageSettings()) el.remove();
    });
  }

  // Auto-init navigation on all pages
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNav);
    } else {
      initNav();
    }
    window.addEventListener('load', initNav);
  }

  // Helper to merge local and cloud user lists without duplicates
  function mergeUsersLists(localList, cloudList) {
    const map = new Map();
    // Default admin is always primary
    map.set('admin', DEFAULT_ADMIN);
    (cloudList || []).forEach(u => {
      const key = (u.username || '').toLowerCase();
      if (key) map.set(key, u);
    });
    (localList || []).forEach(u => {
      const key = (u.username || '').toLowerCase();
      if (key && !map.has(key)) map.set(key, u);
    });
    return Array.from(map.values());
  }

  // Fetch users live from Google Sheet Cloud Database
  async function fetchUsers() {
    let cloudSynced = false;
    let cloudError = null;

    try {
      const url = getAppsScriptUrl();
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=getUsers&_t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (data && data.result === 'success' && Array.isArray(data.users)) {
          const localUsers = getUsers();
          const merged = mergeUsersLists(localUsers, data.users);
          saveUsers(merged);
          return { users: merged, cloudSynced: true };
        }
      } else if (res.status === 403) {
        cloudError = 'HTTP 403 Forbidden: Google Apps Script Web App must be deployed with "Who has access: Anyone".';
      } else {
        cloudError = `HTTP ${res.status}: Cloud server returned an error.`;
      }
    } catch (e) {
      cloudError = e.message || 'Network error connecting to Apps Script.';
      console.warn('Could not fetch cloud users, falling back to local cache:', e);
    }
    return { users: getUsers(), cloudSynced: false, cloudError: cloudError };
  }

  // Export all users (excluding primary admin) as JSON
  function exportUsersJson() {
    const users = getUsers().filter(u => !u.isPrimary && u.username.toLowerCase() !== 'admin');
    const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credbaba-users-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return users;
  }

  // Import user list from JSON file and save locally + sync to cloud
  async function importUsersJson(jsonContent) {
    let list;
    if (typeof jsonContent === 'string') {
      try {
        list = JSON.parse(jsonContent);
      } catch (e) {
        throw new Error('Invalid JSON format: ' + e.message);
      }
    } else if (Array.isArray(jsonContent)) {
      list = jsonContent;
    } else {
      throw new Error('Import data must be a JSON array of users.');
    }

    if (!Array.isArray(list)) {
      throw new Error('Import data must be a JSON array of users.');
    }

    const currentUsers = getUsers();
    let count = 0;
    const errors = [];

    for (const u of list) {
      if (!u || !u.username || u.username.toLowerCase() === 'admin') continue;
      const uname = u.username.toLowerCase().trim();
      const existingIdx = currentUsers.findIndex(cu => cu.username.toLowerCase() === uname);

      const userRecord = {
        username: uname,
        name: (u.name || uname).trim(),
        role: u.role || 'Marketing Editor',
        passwordHash: u.passwordHash,
        status: u.status || 'active',
        createdAt: u.createdAt || new Date().toISOString(),
        isPrimary: false,
        lastUpdated: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        currentUsers[existingIdx] = userRecord;
      } else {
        currentUsers.push(userRecord);
      }
      count++;

      // Attempt cloud sync to Google Sheets
      try {
        const scriptUrl = getAppsScriptUrl();
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveUser', user: userRecord })
        });
      } catch (err) {
        errors.push(`Cloud sync failed for @${uname}: ${err.message}`);
      }
    }

    saveUsers(currentUsers);
    return {
      success: true,
      importedCount: count,
      totalCount: list.length,
      errors: errors
    };
  }

  // Add new user locally AND sync to Google Sheet
  async function addUser(userData) {
    const session = getSession();
    if (!session || !canManageUsers()) {
      return { success: false, message: 'Unauthorized: Super Admin permission required.' };
    }

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

    // 1. Save locally
    users.push(newUser);
    saveUsers(users);

    // 2. Sync to central Google Sheet
    let cloudSynced = false;
    let cloudError = null;

    try {
      const scriptUrl = getAppsScriptUrl();
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveUser',
          user: newUser
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result === 'success') {
          cloudSynced = true;
        } else if (data && data.result === 'error') {
          cloudError = data.message;
        }
      } else if (res.status === 403) {
        cloudError = 'HTTP 403 Forbidden: Google Apps Script Web App must be deployed with "Who has access: Anyone".';
      } else {
        cloudError = `HTTP ${res.status}: Cloud server rejected the user save request.`;
      }
    } catch (e) {
      cloudError = e.message || 'Network error syncing to Google Sheets.';
      console.warn('Apps Script user sync error:', e);
    }

    if (cloudSynced) {
      return {
        success: true,
        cloudSynced: true,
        user: newUser,
        message: `User @${newUser.username} (${newUser.role}) created and synced to Google Sheets cloud.`
      };
    } else {
      return {
        success: true,
        cloudSynced: false,
        cloudError: cloudError,
        user: newUser,
        message: `User @${newUser.username} saved to this device, but Cloud Sync failed (${cloudError || 'offline'}). To access from other devices, set "Who has access: Anyone" in Apps Script or use Export/Import.`
      };
    }
  }

  // Update user role or status
  async function updateUser(username, updates) {
    const session = getSession();
    if (!session || !canManageUsers()) {
      return { success: false, message: 'Unauthorized: Super Admin permission required.' };
    }

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

    // Sync to Google Sheet
    try {
      const scriptUrl = getAppsScriptUrl();
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveUser',
          user: {
            username: target.username,
            name: target.name,
            role: target.role,
            status: target.status
          }
        })
      });
    } catch (e) {
      console.warn('Apps Script updateUser sync error:', e);
    }

    return { success: true, message: `User ${target.username} updated.` };
  }

  // Delete user locally and from Google Sheet
  async function deleteUser(username) {
    const session = getSession();
    if (!session || !canManageUsers()) {
      return { success: false, message: 'Unauthorized: Super Admin permission required.' };
    }

    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, message: 'User not found.' };
    if (user.isPrimary || user.username.toLowerCase() === 'admin') {
      return { success: false, message: 'The primary super admin account cannot be deleted.' };
    }

    const filtered = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    saveUsers(filtered);

    // Delete from Google Sheet
    try {
      const scriptUrl = getAppsScriptUrl();
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteUser',
          username: username
        })
      });
    } catch (e) {
      console.warn('Apps Script deleteUser sync error:', e);
    }

    return { success: true, message: `User ${username} removed successfully.` };
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

    const newHash = await computeHash(newPassword);
    users[userIndex].passwordHash = newHash;
    users[userIndex].lastUpdated = new Date().toISOString();
    saveUsers(users);

    // Sync to Google Sheet
    try {
      const scriptUrl = getAppsScriptUrl();
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveUser',
          user: {
            username: users[userIndex].username,
            passwordHash: newHash
          }
        })
      });
    } catch (e) {}

    return { success: true, message: 'Password updated successfully.' };
  }

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
    enforcePageAccess,
    initNav,
    hasPermission,
    canManageUsers,
    canManageSettings,
    canDeleteBlogs,
    changePassword,
    getUsers,
    fetchUsers,
    addUser,
    updateUser,
    deleteUser,
    exportUsersJson,
    importUsersJson,
    resetToDefaults,
    getRemainingLockoutMs,
    BACKOFFICE_HOSTNAME
  };
})();

// Backward compatibility alias
const CredBabaAdminAuth = CredBabaBackofficeAuth;
