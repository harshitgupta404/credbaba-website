// ==========================================================================
// CredBaba: Blog Storage & Publishing Engine (Option 1: Zero-Git-Commit Cloud CMS)
// Manages real-time blog persistence with Google Sheets (via Google Apps Script),
// instant website synchronization, status toggling (draft/published), deletions,
// image compression, and fallback caching.
// ==========================================================================

const CredBabaBlogStore = (function () {
  'use strict';

  const STORAGE_KEY_CUSTOM_BLOGS = 'credbaba_custom_blogs';
  const STORAGE_KEY_SETTINGS = 'credbaba_admin_settings';

  // Configured default Apps Script Web App URL (can also be configured via Settings in Backoffice)
  const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBskDFL3qYvO5Xg0i9FEcsGig9JJ3Zl44bYbmnQBc9q_cF_AyflphJSLBs7rlr077Y/exec';

  // Built-in SEO cornerstone blogs
  const BUILTIN_BLOGS = [
    {
      id: 'builtin-1',
      isBuiltin: true,
      slug: 'best-home-loan-options-india-interest-rates-tenure',
      title: 'Best Home Loan Options in India 2026: Compare Rates, Tenure & Benefits',
      category: 'Home Loans',
      author: 'CredBaba Research Team',
      publishedAt: '2026-08-15',
      readTime: '8 min read',
      excerpt: 'Compare interest rates, tenure, and features from SBI, HDFC, ICICI, Axis, Kotak, PNB, and LIC Housing Finance. Everything you need to choose the right home loan in 2026.',
      heroImage: '',
      status: 'published',
      url: 'best-home-loan-options-india-interest-rates-tenure'
    },
    {
      id: 'builtin-2',
      isBuiltin: true,
      slug: 'how-to-apply-for-loan-online-india',
      title: 'How to Apply for a Loan Online in India (2026): A Complete Guide',
      category: 'Loan Guide',
      author: 'CredBaba Editorial Team',
      publishedAt: '2026-08-15',
      readTime: '7 min read',
      excerpt: 'A step-by-step guide to applying for a Personal, Business, or Home Loan online in India. Covers eligibility, documents, tips for quick approval, and what to check before you sign.',
      heroImage: '',
      status: 'published',
      url: 'how-to-apply-for-loan-online-india'
    },
    {
      id: 'builtin-3',
      slug: 'personal-loan-vs-credit-card',
      title: 'Personal Loan vs Credit Card Loan: Which Is Better in 2026?',
      category: 'Personal Loans',
      author: 'CredBaba Financial Advisory',
      publishedAt: '2026-08-22',
      readTime: '9 min read',
      excerpt: 'Compare interest rates, tenure, processing speed and credit score impact to decide between a personal loan and a credit card loan. Includes a simple decision guide and FAQs.',
      heroImage: '',
      status: 'published',
      url: 'personal-loan-vs-credit-card'
    },
    {
      id: 'blog_1790675595585_tn0csz',
      isBuiltin: true,
      slug: 'home-loan-online-simple-documents',
      title: 'How to Apply for a Home Loan Online with Simple Documentation: A Complete Guide',
      category: 'Home Loans',
      author: 'CredBaba Editorial Team',
      publishedAt: '2026-09-29',
      readTime: '9 min read',
      excerpt: 'Home loan online made simple: check eligibility, keep KYC and income documents ready, follow the home loan apply steps and avoid common application mistakes.',
      metaDescription: 'Home loan online made simple: check eligibility, keep KYC and income documents ready, follow the home loan apply steps and avoid common application mistakes.',
      heroImage: '/assets/images/blog/home-loan-online-simple-documents.webp',
      status: 'published',
      url: 'home-loan-online-simple-documents'
    }
  ];

  // Helper to read custom blogs from localStorage
  function getCustomBlogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_BLOGS);
      if (raw) {
        const blogs = JSON.parse(raw);
        if (Array.isArray(blogs)) {
          return blogs.map(b => {
            if (!b.url || b.url.startsWith('post.html')) {
              b.url = b.slug;
            }
            return b;
          });
        }
      }
    } catch (e) {
      console.error('Failed to read custom blogs:', e);
    }
    return [];
  }

  function saveCustomBlogs(blogs) {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_BLOGS, JSON.stringify(blogs || []));
    } catch (e) {
      console.error('Failed to save custom blogs:', e);
    }
  }

  // Purge a specific blog from localStorage by slug or ID
  function purgeLocalBlog(slugOrId) {
    if (!slugOrId) return;
    const target = slugOrId.toString().toLowerCase().trim();
    const custom = getCustomBlogs();
    const filtered = custom.filter(b => (b.slug || '').toLowerCase() !== target && (b.id || '') !== target);
    if (filtered.length !== custom.length) {
      saveCustomBlogs(filtered);
    }
  }

  // Get settings (Apps Script Web App URL, GitHub API tokens if any)
  function getSettings() {
    let scriptUrl = DEFAULT_APPS_SCRIPT_URL;
    let githubRepo = 'credbaba-website';
    let githubOwner = 'harshitgupta404';
    let githubBranch = 'main';
    let githubToken = '';

    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.appsScriptUrl) scriptUrl = parsed.appsScriptUrl;
        if (parsed.githubRepo) githubRepo = parsed.githubRepo;
        if (parsed.githubOwner) githubOwner = parsed.githubOwner;
        if (parsed.githubBranch) githubBranch = parsed.githubBranch;
        if (parsed.githubToken) githubToken = parsed.githubToken;
      }
    } catch (e) {
      // ignore
    }

    return {
      appsScriptUrl: scriptUrl,
      githubRepo: githubRepo,
      githubOwner: githubOwner,
      githubBranch: githubBranch,
      githubToken: githubToken
    };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      triggerCrossDomainSettingsSync(settings);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Cross-domain preview sync (mirrors backoffice changes to credbaba.com)
  let syncFrame = null;
  let syncFrameLoaded = false;
  const pendingSyncMessages = [];

  function getSyncFrame() {
    if (typeof window === 'undefined') return null;
    const isBackoffice = window.location.hostname.includes('backoffice') || window.location.port === '8080';
    if (!isBackoffice) return null;

    if (!syncFrame) {
      try {
        syncFrame = document.createElement('iframe');
        syncFrame.src = 'https://credbaba.com/blog/sync-receiver.html';
        syncFrame.style.display = 'none';
        syncFrame.onload = function () {
          syncFrameLoaded = true;
          flushPendingSyncMessages();
        };
        document.body.appendChild(syncFrame);
      } catch (e) {
        return null;
      }
    }
    return syncFrame;
  }

  function flushPendingSyncMessages() {
    if (!syncFrame || !syncFrame.contentWindow) return;
    while (pendingSyncMessages.length > 0) {
      const msg = pendingSyncMessages.shift();
      try {
        syncFrame.contentWindow.postMessage(msg, 'https://credbaba.com');
      } catch (e) {}
    }
  }

  function sendSyncMessage(msg) {
    try {
      const frame = getSyncFrame();
      if (!frame) return;

      if (syncFrameLoaded && frame.contentWindow) {
        frame.contentWindow.postMessage(msg, 'https://credbaba.com');
      } else {
        pendingSyncMessages.push(msg);
      }
    } catch (e) {
      // Never allow iframe synchronization issues to disrupt publishing
    }
  }

  function triggerCrossDomainSync(blogs) {
    sendSyncMessage({ type: 'CB_SYNC_BLOGS', blogs: blogs });
  }

  function triggerCrossDomainSettingsSync(settings) {
    sendSyncMessage({ type: 'CB_SYNC_SETTINGS', settings: settings });
  }

  function triggerCrossDomainDelete(id, slug) {
    sendSyncMessage({ type: 'CB_DELETE_BLOG', id: id, slug: slug });
  }

  // Calculate estimated reading time
  function estimateReadTime(text) {
    const clean = (text || '').replace(/<[^>]*>/g, ' ').trim();
    const wordCount = clean ? clean.split(/\s+/).length : 0;
    const wordsPerMinute = 200;
    const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    return `${minutes} min read`;
  }

  // Slug generator
  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Merge custom blogs with builtins without duplicate slugs
  function mergeWithBuiltins(customList) {
    const custom = Array.isArray(customList) ? customList : [];
    const customSlugs = new Set(custom.map(b => (b.slug || '').toLowerCase()));
    const filteredBuiltins = BUILTIN_BLOGS.filter(b => !customSlugs.has(b.slug.toLowerCase()));
    const combined = [...custom, ...filteredBuiltins];
    return combined.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.publishedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  // Get all blogs synchronously from local cache
  function getAllBlogs() {
    return mergeWithBuiltins(getCustomBlogs());
  }

  // Get only published blogs synchronously from local cache
  function getPublishedBlogs() {
    return getAllBlogs().filter(b => (b.status || '').toLowerCase() === 'published');
  }

  // Get blog by slug synchronously from local cache
  function getBlogBySlug(slug) {
    const clean = (slug || '').toString().toLowerCase().trim();
    const all = getAllBlogs();
    return all.find(b => (b.slug || '').toLowerCase() === clean || (b.id || '') === clean) || null;
  }

  // Save or update blog in local storage AND sync to Google Sheet (Option 1)
  async function saveBlog(blogData) {
    if (!blogData.title || !blogData.title.trim()) {
      throw new Error('Blog title is required.');
    }

    let slug = slugify(blogData.slug || blogData.title);
    if (!slug) slug = 'blog-post-' + Date.now();

    const custom = getCustomBlogs();
    const existingIndex = custom.findIndex(b => (blogData.id && b.id === blogData.id) || (b.slug && b.slug.toLowerCase() === slug));

    const now = new Date();
    const readTime = blogData.readTime || estimateReadTime(blogData.content);
    const blogStatus = (blogData.status || 'published').toLowerCase().trim();

    const blogRecord = {
      id: blogData.id || 'blog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      isBuiltin: false,
      title: blogData.title.trim(),
      slug: slug,
      category: blogData.category || 'Loan Guide',
      author: blogData.author || 'CredBaba Editorial Team',
      publishedAt: blogData.publishedAt || now.toISOString().split('T')[0],
      updatedAt: now.toISOString(),
      readTime: readTime,
      excerpt: (blogData.excerpt || '').trim() || (blogData.title + ' - Financial insights from CredBaba.'),
      metaDescription: (blogData.metaDescription || blogData.excerpt || blogData.title).trim(),
      heroImage: blogData.heroImage || '',
      content: blogData.content || '',
      faqs: Array.isArray(blogData.faqs) ? blogData.faqs : [],
      status: blogStatus, // 'published' or 'draft'
      url: slug
    };

    if (existingIndex >= 0) {
      blogRecord.createdAt = custom[existingIndex].createdAt || blogRecord.publishedAt;
      custom[existingIndex] = blogRecord;
    } else {
      blogRecord.createdAt = now.toISOString();
      custom.unshift(blogRecord);
    }

    // 1. Update local storage & mirror to website
    saveCustomBlogs(custom);
    triggerCrossDomainSync(custom);

    // 2. Sync to Google Apps Script (Option 1)
    const settings = getSettings();
    let cloudSynced = false;
    let cloudError = null;

    if (settings.appsScriptUrl) {
      try {
        const res = await fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveBlog', blog: blogRecord })
        });
        if (res.ok) {
          const respData = await res.json();
          if (respData && respData.result === 'success') {
            cloudSynced = true;
          } else {
            cloudError = respData ? respData.message : 'Apps Script returned non-success response';
            console.warn('Apps Script returned error:', respData);
          }
        } else if (res.status === 403) {
          cloudError = 'HTTP 403 Forbidden: Apps Script Web App must be deployed with "Who has access: Anyone".';
          console.warn('Apps Script 403 Forbidden');
        } else {
          cloudError = `HTTP ${res.status}: Cloud server rejected the save request.`;
        }
      } catch (err) {
        cloudError = err.message || 'Network error syncing to Google Sheets.';
        console.warn('Google Apps Script save warning:', err);
      }
    }

    blogRecord._cloudSynced = cloudSynced;
    blogRecord._cloudError = cloudError;

    return blogRecord;
  }

  // Delete blog locally and from Google Sheet
  async function deleteBlog(idOrSlug) {
    if (!idOrSlug) return false;
    const target = idOrSlug.toString().toLowerCase().trim();

    // Check if it's a builtin
    const isBuiltin = BUILTIN_BLOGS.some(b => b.id === target || b.slug.toLowerCase() === target);
    if (isBuiltin) {
      throw new Error('Built-in SEO cornerstone articles cannot be deleted directly.');
    }

    const custom = getCustomBlogs();
    const blogToDelete = custom.find(b => (b.id && b.id.toLowerCase() === target) || (b.slug && b.slug.toLowerCase() === target));
    const targetId = blogToDelete ? blogToDelete.id : idOrSlug;
    const targetSlug = blogToDelete ? blogToDelete.slug : idOrSlug;

    const filtered = custom.filter(b => (b.id && b.id.toLowerCase() !== target) && (b.slug && b.slug.toLowerCase() !== target));

    // Update local storage
    saveCustomBlogs(filtered);
    triggerCrossDomainSync(filtered);
    triggerCrossDomainDelete(targetId, targetSlug);

    // Delete from Google Sheet via Apps Script
    const settings = getSettings();
    if (settings.appsScriptUrl) {
      try {
        await fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'deleteBlog',
            id: targetId,
            slug: targetSlug
          })
        });
      } catch (err) {
        console.warn('Google Apps Script delete warning:', err);
      }
    }

    return true;
  }

  // Toggle blog status between 'published' and 'draft'
  async function toggleBlogStatus(idOrSlug) {
    const blog = getBlogBySlug(idOrSlug);
    if (!blog) throw new Error('Article not found.');
    if (blog.isBuiltin) throw new Error('Cannot toggle status of built-in cornerstone articles.');

    const newStatus = (blog.status === 'published') ? 'draft' : 'published';
    blog.status = newStatus;
    const saved = await saveBlog(blog);
    return saved;
  }

  // Helper to merge lists of custom blogs without duplicate slugs or IDs, preserving full article content & FAQs
  function mergeCustomLists(primary, secondary) {
    const map = new Map();
    const existingById = new Map();
    const existingBySlug = new Map();

    (secondary || []).forEach(b => {
      if (!b) return;
      if (b.id) existingById.set(b.id, b);
      if (b.slug) existingBySlug.set((b.slug || '').toLowerCase().trim(), b);
    });

    (primary || []).forEach(b => {
      if (!b) return;
      const bSlug = (b.slug || '').toLowerCase().trim();
      const existing = (b.id ? existingById.get(b.id) : null) || (bSlug ? existingBySlug.get(bSlug) : null);

      let merged = b;
      if (existing) {
        merged = {
          ...existing,
          ...b,
          // If incoming lightweight summary has empty content/faqs, preserve full existing content/faqs
          content: (b.content && b.content.trim()) ? b.content : (existing.content || ''),
          faqs: (Array.isArray(b.faqs) && b.faqs.length > 0) ? b.faqs : (existing.faqs || [])
        };
      }

      const key = b.id || bSlug || ('item_' + Math.random());
      map.set(key, merged);
    });

    // Also preserve any existing blogs that were in secondary but not in primary (e.g. offline drafts)
    (secondary || []).forEach(b => {
      if (!b) return;
      const bSlug = (b.slug || '').toLowerCase().trim();
      const alreadyInMap = (b.id && map.has(b.id)) || (bSlug && map.has(bSlug));
      if (!alreadyInMap) {
        const key = b.id || bSlug;
        if (key) map.set(key, b);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.publishedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  // High-performance fetch wrapper with AbortController timeout to guarantee sub-second fallbacks
  async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, options);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // Non-blocking background revalidation of a blog post
  async function revalidateBlogInBackground(cleanSlug, includeDraft) {
    const settings = getSettings();
    if (!settings.appsScriptUrl) return;
    try {
      const previewQuery = includeDraft ? '&preview=1' : '';
      const res = await fetchWithTimeout(
        settings.appsScriptUrl + '?action=getBlog&slug=' + encodeURIComponent(cleanSlug) + '&id=' + encodeURIComponent(cleanSlug) + previewQuery + '&_t=' + Date.now(),
        {},
        4000
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.result === 'success' && data.blog) {
          const custom = getCustomBlogs();
          const targetSlug = (data.blog.slug || cleanSlug).toLowerCase();
          const idx = custom.findIndex(b => (b.slug || '').toLowerCase() === targetSlug || b.id === data.blog.id || (b.slug || '').toLowerCase() === cleanSlug);
          if (idx >= 0) {
            custom[idx] = { ...custom[idx], ...data.blog };
          } else {
            custom.unshift(data.blog);
          }
          saveCustomBlogs(custom);
        } else if (data && data.result === 'not_found' && !includeDraft) {
          purgeLocalBlog(cleanSlug);
        }
      }
    } catch (e) {
      // Background revalidation silently ignores network timeouts
    }
  }

  // Asynchronously fetch published blogs for public website (credbaba.com/blog/)
  // Guaranteed < 100ms response via multi-tiered caching: Local Storage -> Static Edge CDN -> Cloud
  async function fetchPublishedBlogs() {
    const settings = getSettings();

    // 1. Instant Synchronous Cache Check (< 1ms)
    const local = getCustomBlogs().filter(b => (b.status || '').toLowerCase() === 'published');
    const localCombined = mergeWithBuiltins(local);

    // 2. Fetch from static Fastly/GitHub CDN blogs.json (~30-60ms)
    try {
      const cdnUrl = (typeof window !== 'undefined' && window.location.origin.includes('credbaba.com'))
        ? '/blog/data/blogs.json?_t=' + Date.now()
        : 'https://credbaba.com/blog/data/blogs.json?_t=' + Date.now();
      const cdnRes = await fetchWithTimeout(cdnUrl, {}, 1200);
      if (cdnRes.ok) {
        const cdnBlogs = await cdnRes.json();
        if (Array.isArray(cdnBlogs) && cdnBlogs.length > 0) {
          const publishedCdn = cdnBlogs.filter(b => (b.status || '').toLowerCase() === 'published');
          const combined = mergeCustomLists(local, publishedCdn);
          return mergeWithBuiltins(combined);
        }
      }
    } catch (e) {}

    // 3. Fallback to live Google Apps Script with 6.5s timeout (prevents cold-start timeout)
    if (settings.appsScriptUrl) {
      try {
        const res = await fetchWithTimeout(settings.appsScriptUrl + '?action=getBlogs&_t=' + Date.now(), {}, 6500);
        if (res.ok) {
          const data = await res.json();
          if (data && data.result === 'success' && Array.isArray(data.blogs)) {
            const publishedFromSheet = data.blogs.filter(b => (b.status || '').toLowerCase() === 'published');
            const merged = mergeCustomLists(publishedFromSheet, getCustomBlogs());
            saveCustomBlogs(merged);
            return mergeWithBuiltins(merged.filter(b => (b.status || '').toLowerCase() === 'published'));
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchPublishedBlogs timed out or failed, returning local cache:', e);
      }
    }

    return localCombined;
  }

  // Asynchronously fetch blog by slug or ID for public reader & editor
  // Guaranteed SUB-SECOND fetch:
  // Tier 1: Local / Built-in cache (0ms instant return + background cloud revalidation if content exists)
  // Tier 2: Static Edge CDN /blog/data/blogs.json (~30-80ms if content exists)
  // Tier 3: Live Apps Script with 6.5s hard timeout
  async function fetchBlogBySlug(slug, options = {}) {
    if (!slug) return null;
    const cleanSlug = slug.toString().toLowerCase().trim();
    const settings = getSettings();
    const includeDraft = Boolean(options.includeDraft);
    const skipLocal = Boolean(options.skipLocal);

    // TIER 1: Instant Synchronous Cache Check (0ms latency!)
    // Only return Tier 1 if the cached blog actually contains article content
    if (!skipLocal) {
      const localMatch = getBlogBySlug(cleanSlug);
      if (localMatch && localMatch.content && localMatch.content.trim()) {
        const matchStatus = (localMatch.status || '').toLowerCase();
        if (matchStatus === 'published' || includeDraft) {
          // Trigger non-blocking cloud revalidation in the background so local copy stays fresh
          if (!options.skipRevalidate && settings.appsScriptUrl) {
            setTimeout(() => {
              revalidateBlogInBackground(cleanSlug, includeDraft);
            }, 60);
          }
          return localMatch;
        }
        return null;
      }
    }

    // TIER 2: Ultra-Fast Static Edge CDN Check (< 80ms)
    try {
      const cdnUrl = (typeof window !== 'undefined' && window.location.origin.includes('credbaba.com'))
        ? '/blog/data/blogs.json?_t=' + Date.now()
        : 'https://credbaba.com/blog/data/blogs.json?_t=' + Date.now();
      const cdnRes = await fetchWithTimeout(cdnUrl, {}, 1200);
      if (cdnRes.ok) {
        const cdnBlogs = await cdnRes.json();
        if (Array.isArray(cdnBlogs)) {
          const cdnMatch = cdnBlogs.find(b => (b.slug || '').toLowerCase() === cleanSlug || (b.id || '') === cleanSlug);
          if (cdnMatch && cdnMatch.content && cdnMatch.content.trim()) {
            const status = (cdnMatch.status || '').toLowerCase();
            if (status === 'published' || includeDraft) {
              // Cache locally for next time
              try {
                const custom = getCustomBlogs();
                const idx = custom.findIndex(b => (b.slug || '').toLowerCase() === cleanSlug || b.id === cdnMatch.id);
                if (idx >= 0) custom[idx] = { ...custom[idx], ...cdnMatch };
                else custom.unshift(cdnMatch);
                saveCustomBlogs(custom);
              } catch (err) {}
              return cdnMatch;
            }
            return null;
          }
        }
      }
    } catch (e) {}

    // TIER 3: Cloud Apps Script with 6.5s Timeout
    if (settings.appsScriptUrl) {
      try {
        const previewQuery = includeDraft ? '&preview=1' : '';
        const res = await fetchWithTimeout(
          settings.appsScriptUrl + '?action=getBlog&slug=' + encodeURIComponent(cleanSlug) + '&id=' + encodeURIComponent(cleanSlug) + previewQuery + '&_t=' + Date.now(),
          {},
          6500
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.result === 'success' && data.blog) {
            const status = (data.blog.status || '').toLowerCase();
            if (status === 'published' || includeDraft) {
              // Cache locally for next time with full content preserved
              try {
                const custom = getCustomBlogs();
                const targetSlug = (data.blog.slug || cleanSlug).toLowerCase();
                const idx = custom.findIndex(b => (b.slug || '').toLowerCase() === targetSlug || b.id === data.blog.id || (b.slug || '').toLowerCase() === cleanSlug);
                if (idx >= 0) {
                  custom[idx] = { ...custom[idx], ...data.blog };
                } else {
                  custom.unshift(data.blog);
                }
                saveCustomBlogs(custom);
              } catch (err) {}
              return data.blog;
            }
            return null;
          }
          if (data && data.result === 'not_found' && !includeDraft) {
            purgeLocalBlog(cleanSlug);
            return null;
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchBlogBySlug timed out or failed, falling back:', e);
      }
    }

    // TIER 4: Final fallback check in local store or builtin
    const finalMatch = getBlogBySlug(cleanSlug);
    if (finalMatch) {
      const status = (finalMatch.status || '').toLowerCase();
      if (status === 'published' || includeDraft) return finalMatch;
    }

    return null;
  }

  // Asynchronously fetch ALL blogs (published + drafts) for Backoffice table
  async function fetchAllBlogs() {
    const settings = getSettings();
    if (settings.appsScriptUrl) {
      try {
        const res = await fetch(settings.appsScriptUrl + '?action=getAllBlogs&_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.result === 'success' && Array.isArray(data.blogs)) {
            const merged = mergeCustomLists(data.blogs, getCustomBlogs());
            saveCustomBlogs(merged);
            return mergeWithBuiltins(merged);
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchAllBlogs failed, checking static fallback:', e);
      }
    }

    // Static fallback: check /blog/data/blogs.json
    try {
      const cdnUrl = (typeof window !== 'undefined' && window.location.origin.includes('credbaba.com'))
        ? '/blog/data/blogs.json?_t=' + Date.now()
        : 'https://credbaba.com/blog/data/blogs.json?_t=' + Date.now();
      const cdnRes = await fetch(cdnUrl);
      if (cdnRes.ok) {
        const cdnBlogs = await cdnRes.json();
        if (Array.isArray(cdnBlogs) && cdnBlogs.length > 0) {
          const current = getCustomBlogs();
          const merged = mergeCustomLists(current, cdnBlogs);
          saveCustomBlogs(merged);
          return mergeWithBuiltins(merged);
        }
      }
    } catch (e) {}

    return getAllBlogs();
  }

  // Live Cloud Diagnostics Tool
  async function testCloudConnection(customUrl) {
    const url = (customUrl || getSettings().appsScriptUrl || '').trim();
    if (!url) {
      return {
        ok: false,
        status: 0,
        code: 'NO_URL',
        message: 'No Google Apps Script Web App URL configured in Settings.'
      };
    }

    try {
      const pingUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping&_t=' + Date.now();
      const res = await fetch(pingUrl);

      if (res.status === 403) {
        return {
          ok: false,
          status: 403,
          code: 'FORBIDDEN_403',
          message: 'HTTP 403 Forbidden: Google Apps Script Web App access is restricted.',
          instructions: 'In Google Sheets, go to Extensions -> Apps Script -> Deploy -> Manage deployments -> Edit active deployment -> Change "Who has access" to "Anyone" -> Deploy.'
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          code: 'HTTP_ERROR',
          message: `Server returned HTTP ${res.status}: ${res.statusText}.`
        };
      }

      const data = await res.json();
      if (data && data.result === 'success') {
        return {
          ok: true,
          status: 200,
          code: 'SUCCESS',
          message: `Connected successfully to Google Sheet "${data.spreadsheet || 'CredBaba Blogs'}"!`,
          data: data
        };
      }

      return {
        ok: false,
        status: 200,
        code: 'APP_ERROR',
        message: data.message || 'Script responded with an error.'
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Network or CORS error connecting to Apps Script. (If the Web App is not set to "Anyone", browsers block cross-origin requests): ' + err.message
      };
    }
  }

  // Export all articles (builtins + custom) as portable JSON file
  function exportAllBlogsJson() {
    const blogs = getAllBlogs();
    const blob = new Blob([JSON.stringify(blogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credbaba-blogs-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return blogs;
  }

  // Import articles array from JSON file and save locally + sync to cloud
  async function importBlogsJson(jsonContent) {
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
      throw new Error('Import data must be a JSON array of blogs.');
    }

    if (!Array.isArray(list)) {
      throw new Error('Import data must be a JSON array of blog articles.');
    }

    let successCount = 0;
    const errors = [];

    for (const b of list) {
      if (!b || !b.title) continue;
      try {
        await saveBlog(b);
        successCount++;
      } catch (err) {
        errors.push(`Error saving "${b.title}": ${err.message}`);
      }
    }

    return {
      success: true,
      importedCount: successCount,
      totalCount: list.length,
      errors: errors
    };
  }

  // Legacy / optional GitHub publisher (kept for backup or manual repository commit)
  async function publishToGitHub(blog) {
    const settings = getSettings();
    const token = settings.githubToken;
    const owner = settings.githubOwner || 'harshitgupta404';
    const repo = settings.githubRepo || 'credbaba-website';
    const branch = settings.githubBranch || 'main';

    if (!token || !owner || !repo) {
      throw new Error('GitHub API token not configured in Backoffice Settings.');
    }

    const apiHeaders = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    let blogsList = [];
    let fileSha = null;
    try {
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/blog/data/blogs.json?ref=${branch}`, {
        headers: apiHeaders
      });
      if (getRes.ok) {
        const fileData = await getRes.json();
        fileSha = fileData.sha;
        const decoded = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
        blogsList = JSON.parse(decoded);
      }
    } catch (e) {
      console.warn('Could not read existing blogs.json from GitHub:', e);
    }

    const existingIndex = blogsList.findIndex(b => b.id === blog.id || b.slug === blog.slug);
    if (existingIndex >= 0) {
      blogsList[existingIndex] = blog;
    } else {
      blogsList.unshift(blog);
    }

    const updatedJsonString = JSON.stringify(blogsList, null, 2);
    const jsonBase64 = btoa(unescape(encodeURIComponent(updatedJsonString)));

    const putJsonRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/blog/data/blogs.json`, {
      method: 'PUT',
      headers: apiHeaders,
      body: JSON.stringify({
        message: `feat(blog): publish "${blog.title}" to blog directory`,
        content: jsonBase64,
        sha: fileSha || undefined,
        branch: branch
      })
    });

    if (!putJsonRes.ok) {
      const err = await putJsonRes.json();
      throw new Error(err.message || 'Failed to update blogs.json on GitHub');
    }

    // Also commit the static HTML file blog/${blog.slug}.html for 100% SEO indexing and clean URL
    try {
      const htmlContent = generateStaticHtml(blog);
      const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
      let htmlSha = null;
      try {
        const getHtmlRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/blog/${blog.slug}.html?ref=${branch}`, {
          headers: apiHeaders
        });
        if (getHtmlRes.ok) {
          const htmlData = await getHtmlRes.json();
          htmlSha = htmlData.sha;
        }
      } catch (e) {}

      await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/blog/${blog.slug}.html`, {
        method: 'PUT',
        headers: apiHeaders,
        body: JSON.stringify({
          message: `feat(blog): publish static page for "${blog.title}"`,
          content: htmlBase64,
          sha: htmlSha || undefined,
          branch: branch
        })
      });
    } catch (htmlErr) {
      console.warn('Could not write static HTML file to GitHub:', htmlErr);
    }

    return {
      success: true,
      message: 'Successfully published to GitHub Pages repository! Live site will update in ~30 seconds.'
    };
  }

  // Image compressor: scales to web size, returns optimized dataURL
  function compressImage(file, maxDimension = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Please select a valid image file.'));
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let outputType = 'image/jpeg';
          try {
            const testCanvas = document.createElement('canvas');
            if (testCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
              outputType = 'image/webp';
            }
          } catch (err) {
            outputType = 'image/jpeg';
          }

          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image for processing.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  // Generate static HTML export string matching CredBaba blog standards
  function generateStaticHtml(blog) {
    const formattedDate = new Date(blog.publishedAt || Date.now()).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const faqItemsHtml = (blog.faqs || []).map(faq => `
    <div class="faq-item">
      <button class="faq-question" aria-expanded="false">
        ${escapeHtml(faq.q)}
        <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div class="faq-answer">${faq.a}</div>
    </div>`).join('\n');

    const heroImageHtml = blog.heroImage ? `
    <div class="blog-hero-image-wrap" style="margin: var(--space-4) 0 var(--space-4); border-radius: var(--radius-lg); overflow: hidden; max-height: 480px; border: 1px solid var(--color-border);">
      <img src="${blog.heroImage}" alt="${escapeHtml(blog.title)}" style="width: 100%; height: auto; object-fit: cover; display: block;" />
    </div>` : '';

    const isDuplicateExcerpt = (blog.excerpt || '').trim().toLowerCase() === (blog.title || '').trim().toLowerCase();
    const introHtml = (blog.excerpt && !isDuplicateExcerpt)
      ? `<div class="blog-intro" style="margin: var(--space-2) 0 var(--space-5);">${escapeHtml(blog.excerpt)}</div>`
      : '';
    const cleanContent = (blog.content || '')
      .replace(/^(\s*<p[^>]*>(\s*<br\s*\/?>|\s*&nbsp;|\s*)*<\/p>\s*|\s*<br\s*\/?>\s*)+/i, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<script>
  (function(){
    var t = localStorage.getItem('credbaba-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(blog.title)} | CredBaba</title>
<meta name="description" content="${escapeHtml(blog.metaDescription || blog.excerpt || blog.title)}">
<link rel="canonical" href="https://credbaba.com/blog/${blog.slug}" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%234338CA%22/><text x=%2250%22 y=%2266%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22%23C9A227%22 font-family=%22monospace%22>C</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/tokens.css">
<link rel="stylesheet" href="../assets/css/site.css">
</head>
<body>
<header class="site-header">
  <div class="container">
    <a href="../index.html" class="brand"><span class="brand-mark">CB</span>CredBaba</a>
    <nav class="nav-desktop">
      <div class="nav-links">
        <a href="../index.html">Home</a>
        <a href="../home-loan/">Home Loan</a>
        <a href="../personal-loan/">Personal Loan</a>
        <a href="../business-loan/">Business Loan</a>
        <a href="index.html" class="active">Blog</a>
      </div>
    </nav>
  </div>
</header>
<main class="container">
  <div class="blog-post-header">
    <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="index.html">Blog</a> / ${escapeHtml(blog.title)}</div>
    <div class="eyebrow">${escapeHtml(blog.category.toUpperCase())} · ${formattedDate.toUpperCase()}</div>
    <h1>${escapeHtml(blog.title)}</h1>
    <div class="blog-meta">By ${escapeHtml(blog.author)} &nbsp;·&nbsp; ${blog.readTime}</div>
  </div>
  ${heroImageHtml}
  <div class="blog-content">
    ${introHtml}
    ${cleanContent}
    ${faqItemsHtml ? `<h2>Frequently Asked Questions</h2>\n${faqItemsHtml}` : ''}
    <div class="blog-cta">
      <h2>Explore Low Interest Loan Options with CredBaba</h2>
      <p>Submit your loan inquiry online in 2 minutes. Transparent options, fast approvals, zero spam.</p>
      <a href="../business-loan/" class="btn">Apply Online Today →</a>
    </div>
  </div>
</main>
<footer class="site-footer">
  <div class="container">
    <div class="ledger-line"></div>
    <div class="footer-bottom">
      <span>© 2026 CredBaba. All rights reserved.</span>
    </div>
  </div>
</footer>
<script src="../assets/js/theme.js"></script>
</body>
</html>`;
  }

  // Download static HTML file in browser
  function downloadBlogHtml(blog) {
    const html = generateStaticHtml(blog);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${blog.slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Escape HTML helper
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    getAllBlogs,
    getPublishedBlogs,
    getBlogBySlug,
    fetchBlogBySlug,
    fetchPublishedBlogs,
    fetchAllBlogs,
    publishToGitHub,
    triggerCrossDomainSync,
    triggerCrossDomainSettingsSync,
    saveBlog,
    deleteBlog,
    toggleBlogStatus,
    compressImage,
    generateStaticHtml,
    downloadBlogHtml,
    estimateReadTime,
    slugify,
    getSettings,
    saveSettings,
    testCloudConnection,
    exportAllBlogsJson,
    importBlogsJson,
    escapeHtml
  };
})();
