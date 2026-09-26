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
    passwordHash: 'b99905801b4a6f74bec41a53623d5f9206c158b73a668b418bf01de49fa8a952', // 'Admin@CredBaba2026#Secure'
    status: 'active',
    createdAt: '2026-08-15T00:00:00.000Z',
    isPrimary: true
  };

  // Domain guard: ensure normal users on credbaba.com don't stumble onto backoffice
  function checkDomainIsolation() {
    const host = window.location.hostname;
    // Allow local development and GitHub Pages staging
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.github.io')) {
      return;
    }
    // If accessed on primary public site (credbaba.com), redirect to backoffice subdomain
    if (host === 'credbaba.com' || host === 'www.credbaba.com') {
      const targetPath = window.location.pathname.replace(/^\/admin/, '/backoffice');
      window.location.replace(`https://${BACKOFFICE_HOSTNAME}${targetPath}${window.location.search}`);
    }
  }

  // Run domain isolation check immediately
  checkDomainIsolation();

  // Web Crypto SHA-256 helper
  async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(SALT + text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateSessionToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
