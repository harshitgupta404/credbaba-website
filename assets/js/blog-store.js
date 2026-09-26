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
  const DEFAULT_APPS_SCRIPT_URL = '';

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
      url: 'best-home-loan-options-india-interest-rates-tenure.html'
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
      url: 'how-to-apply-for-loan-online-india.html'
    },
    {
      id: 'builtin-3',
      isBuiltin: true,
      slug: 'personal-loan-vs-credit-card',
      title: 'Personal Loan vs Credit Card Loan: Which Is Better in 2026?',
      category: 'Personal Loans',
      author: 'CredBaba Financial Advisory',
      publishedAt: '2026-08-22',
      readTime: '9 min read',
      excerpt: 'Compare interest rates, tenure, processing speed and credit score impact to decide between a personal loan and a credit card loan. Includes a simple decision guide and FAQs.',
      heroImage: '',
      status: 'published',
      url: 'personal-loan-vs-credit-card.html'
    }
  ];

  // Helper to read custom blogs from localStorage
  function getCustomBlogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_BLOGS);
      if (raw) {
        return JSON.parse(raw);
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
  function getSyncFrame() {
    if (typeof window === 'undefined') return null;
    const isBackoffice = window.location.hostname.includes('backoffice') || window.location.port === '8080';
    if (!isBackoffice) return null;

    if (!syncFrame) {
      syncFrame = document.createElement('iframe');
      syncFrame.src = 'https://credbaba.com/blog/sync-receiver.html';
      syncFrame.style.display = 'none';
      document.body.appendChild(syncFrame);
    }
    return syncFrame;
  }

  function triggerCrossDomainSync(blogs) {
    const frame = getSyncFrame();
    if (!frame) return;

    const sendMessage = () => {
      try {
        frame.contentWindow.postMessage({ type: 'CB_SYNC_BLOGS', blogs: blogs }, 'https://credbaba.com');
      } catch (e) {}
    };

    if (frame.contentWindow && frame.contentWindow.document && frame.contentWindow.document.readyState === 'complete') {
      sendMessage();
    } else {
      frame.onload = sendMessage;
    }
  }

  function triggerCrossDomainSettingsSync(settings) {
    const frame = getSyncFrame();
    if (!frame) return;

    const sendMessage = () => {
      try {
        frame.contentWindow.postMessage({ type: 'CB_SYNC_SETTINGS', settings: settings }, 'https://credbaba.com');
      } catch (e) {}
    };

    if (frame.contentWindow && frame.contentWindow.document && frame.contentWindow.document.readyState === 'complete') {
      sendMessage();
    } else {
      frame.onload = sendMessage;
    }
  }

  function triggerCrossDomainDelete(id, slug) {
    const frame = getSyncFrame();
    if (!frame) return;

    const sendMessage = () => {
      try {
        frame.contentWindow.postMessage({ type: 'CB_DELETE_BLOG', id: id, slug: slug }, 'https://credbaba.com');
      } catch (e) {}
    };

    if (frame.contentWindow && frame.contentWindow.document && frame.contentWindow.document.readyState === 'complete') {
      sendMessage();
    } else {
      frame.onload = sendMessage;
    }
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
      url: `post.html?slug=${slug}`
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
    if (settings.appsScriptUrl) {
      try {
        const res = await fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveBlog', blog: blogRecord })
        });
        if (res.ok) {
          const respData = await res.json();
          if (respData && respData.result === 'error') {
            console.warn('Apps Script returned error:', respData.message);
          }
        }
      } catch (err) {
        console.warn('Google Apps Script save warning:', err);
      }
    }

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

  // Asynchronously fetch published blogs for public website (credba.com/blog/)
  // Ensures drafts and deleted articles are NEVER shown
  async function fetchPublishedBlogs() {
    const settings = getSettings();

    // 1. Fetch live published blogs from Google Apps Script (Option 1)
    if (settings.appsScriptUrl) {
      try {
        const res = await fetch(settings.appsScriptUrl + '?action=getBlogs&_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.result === 'success' && Array.isArray(data.blogs)) {
            // STRICT FILTER: Only published blogs from sheet
            const publishedFromSheet = data.blogs.filter(b => (b.status || '').toLowerCase() === 'published');
            // Update local cache with live truth
            saveCustomBlogs(publishedFromSheet);
            return mergeWithBuiltins(publishedFromSheet);
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchPublishedBlogs failed, falling back to local cache:', e);
      }
    }

    // 2. Fallback: filter local custom blogs STRICTLY for published
    const local = getCustomBlogs().filter(b => (b.status || '').toLowerCase() === 'published');
    return mergeWithBuiltins(local);
  }

  // Asynchronously fetch blog by slug for public reader (credbaba.com/blog/post.html?slug=...)
  // Strictly blocks drafts from public view unless { includeDraft: true } is explicitly passed
  async function fetchBlogBySlug(slug, options = {}) {
    if (!slug) return null;
    const cleanSlug = slug.toString().toLowerCase().trim();
    const settings = getSettings();
    const includeDraft = Boolean(options.includeDraft);

    // Check if it's a builtin
    const builtin = BUILTIN_BLOGS.find(b => b.slug.toLowerCase() === cleanSlug || b.id === cleanSlug);

    // 1. Query live Google Apps Script if configured
    if (settings.appsScriptUrl) {
      try {
        const previewQuery = includeDraft ? '&preview=1' : '';
        const res = await fetch(settings.appsScriptUrl + '?action=getBlog&slug=' + encodeURIComponent(cleanSlug) + previewQuery + '&_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.result === 'success' && data.blog) {
            const status = (data.blog.status || '').toLowerCase();
            if (status === 'published' || includeDraft) {
              return data.blog;
            }
            // Article is in draft and public user is requesting: treat as not found
            return null;
          }
          if (data && data.result === 'not_found') {
            // Purge local cache of this deleted/draft article
            purgeLocalBlog(cleanSlug);
            return builtin || null;
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchBlogBySlug failed, falling back to local cache:', e);
      }
    }

    // 2. Fallback to local storage
    const custom = getCustomBlogs();
    const match = custom.find(b => (b.slug || '').toLowerCase() === cleanSlug || (b.id || '') === cleanSlug);
    if (match) {
      const matchStatus = (match.status || '').toLowerCase();
      // STRICT: Only return if status is published or draft preview is allowed
      if (matchStatus === 'published' || includeDraft) {
        return match;
      }
      // Draft article requested without preview privileges: hidden from website!
      return null;
    }

    return builtin || null;
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
            saveCustomBlogs(data.blogs);
            return mergeWithBuiltins(data.blogs);
          }
        }
      } catch (e) {
        console.warn('Apps Script fetchAllBlogs failed:', e);
      }
    }
    return getAllBlogs();
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
    <div class="blog-hero-image-wrap" style="margin: var(--space-6) 0 var(--space-7); border-radius: var(--radius-lg); overflow: hidden; max-height: 480px; border: 1px solid var(--color-border);">
      <img src="${blog.heroImage}" alt="${escapeHtml(blog.title)}" style="width: 100%; height: auto; object-fit: cover; display: block;" />
    </div>` : '';

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
    ${blog.excerpt ? `<div class="blog-intro">${escapeHtml(blog.excerpt)}</div>` : ''}
    ${blog.content}
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
    escapeHtml
  };
})();
