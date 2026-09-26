// ==========================================================================
// CredBaba: Blog Storage & Publishing Engine
// Manages blog data persistence, image compression, static HTML generation,
// and website synchronization.
// ==========================================================================

const CredBabaBlogStore = (function () {
  'use strict';

  const STORAGE_KEY_CUSTOM_BLOGS = 'credbaba_custom_blogs';
  const STORAGE_KEY_SETTINGS = 'credbaba_admin_settings';

  // Seed / Built-in blogs already existing on the website
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
      localStorage.setItem(STORAGE_KEY_CUSTOM_BLOGS, JSON.stringify(blogs));
    } catch (e) {
      console.error('Failed to save custom blogs:', e);
      throw new Error('Local storage quota exceeded. Consider compressing images before saving.');
    }
  }

  // Get settings (GitHub API, Apps Script Web App URL, etc.)
  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
    return {
      githubRepo: 'credbaba-website',
      githubOwner: '',
      githubBranch: 'main',
      githubToken: '',
      appsScriptUrl: ''
    };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
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

  // Get all blogs (builtins + custom)
  function getAllBlogs() {
    const custom = getCustomBlogs();
    const customSlugs = new Set(custom.map(b => b.slug));
    
    // Filter out builtins if overridden by custom with same slug
    const filteredBuiltins = BUILTIN_BLOGS.filter(b => !customSlugs.has(b.slug));
    
    // Custom blogs first, sorted by updated/published date descending
    const combined = [...custom, ...filteredBuiltins];
    return combined.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.publishedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  // Get only published blogs
  function getPublishedBlogs() {
    return getAllBlogs().filter(b => b.status === 'published');
  }

  // Get blog by slug or ID
  function getBlogBySlug(slug) {
    const all = getAllBlogs();
    return all.find(b => b.slug === slug || b.id === slug) || null;
  }

  // Save or update blog
  async function saveBlog(blogData) {
    if (!blogData.title || !blogData.title.trim()) {
      throw new Error('Blog title is required.');
    }

    let slug = slugify(blogData.slug || blogData.title);
    if (!slug) slug = 'blog-post-' + Date.now();

    const custom = getCustomBlogs();
    const existingIndex = custom.findIndex(b => b.id === blogData.id || b.slug === slug);

    const now = new Date();
    const readTime = blogData.readTime || estimateReadTime(blogData.content);

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
      status: blogData.status || 'published', // 'published' or 'draft'
      url: `post.html?slug=${slug}`
    };

    if (existingIndex >= 0) {
      // Preserve original creation date
      blogRecord.createdAt = custom[existingIndex].createdAt || blogRecord.publishedAt;
      custom[existingIndex] = blogRecord;
    } else {
      blogRecord.createdAt = now.toISOString();
      custom.unshift(blogRecord);
    }

    saveCustomBlogs(custom);

    // Optional background sync to Apps Script or GitHub if configured
    const settings = getSettings();
    if (settings.appsScriptUrl) {
      try {
        fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveBlog', blog: blogRecord })
        }).catch(err => console.warn('Apps script sync failed:', err));
      } catch (e) {
        // ignore
      }
    }

    return blogRecord;
  }

  // Delete blog
  function deleteBlog(idOrSlug) {
    const custom = getCustomBlogs();
    const filtered = custom.filter(b => b.id !== idOrSlug && b.slug !== idOrSlug);
    if (filtered.length === custom.length) {
      // Check if it's a builtin
      const isBuiltin = BUILTIN_BLOGS.some(b => b.id === idOrSlug || b.slug === idOrSlug);
      if (isBuiltin) {
        throw new Error('Built-in SEO blogs cannot be deleted directly, but can be customized.');
      }
      return false;
    }
    saveCustomBlogs(filtered);
    return true;
  }

  // Image compressor: handles massive camera/phone images, scales to web size, returns optimized dataURL
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
          
          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use WebP if supported, otherwise JPEG
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

  // Generate a standalone static HTML file string matching CredBaba blog standards
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
<style>
  .blog-post-header { padding: var(--space-9) 0 var(--space-5); max-width: 820px; }
  .blog-post-header h1 { font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl)); margin-bottom: var(--space-4); line-height: 1.25; }
  .blog-meta { color: var(--color-ink-faint); font-size: var(--text-sm); margin-bottom: var(--space-4); }
  .blog-intro { font-size: var(--text-lg); color: var(--color-ink-soft); line-height: 1.7; border-left: 3px solid var(--color-indigo); padding-left: var(--space-5); margin: var(--space-5) 0; }
  .blog-content { max-width: 820px; padding-bottom: var(--space-10); font-size: var(--text-base); }
  .blog-content h2 { font-size: var(--text-2xl); margin-top: var(--space-9); margin-bottom: var(--space-4); line-height: 1.3; }
  .blog-content h3 { font-size: var(--text-xl); margin-top: var(--space-6); margin-bottom: var(--space-3); color: var(--color-ink); }
  .blog-content h4 { font-size: var(--text-lg); margin-top: var(--space-5); margin-bottom: var(--space-2); }
  .blog-content p { color: var(--color-ink-soft); line-height: 1.8; margin-bottom: var(--space-5); }
  .blog-content ul, .blog-content ol { color: var(--color-ink-soft); line-height: 1.75; margin-bottom: var(--space-5); padding-left: 1.6em; }
  .blog-content li { margin-bottom: var(--space-2); }
  .blog-content strong { color: var(--color-ink); font-weight: 600; }
  .blog-content blockquote { border-left: 4px solid var(--color-gold); background: var(--color-surface); padding: var(--space-4) var(--space-6); border-radius: 0 var(--radius-md) var(--radius-md) 0; margin: var(--space-6) 0; color: var(--color-ink); font-style: italic; }
  .breadcrumb { font-size: var(--text-sm); color: var(--color-ink-faint); margin-bottom: var(--space-4); }
  .breadcrumb a { color: var(--color-indigo); text-decoration: none; }
  .breadcrumb a:hover { text-decoration: underline; }
  
  /* Media styling */
  .blog-content img, .blog-inline-img { max-width: 100%; height: auto; border-radius: var(--radius-md); margin: var(--space-6) 0; border: 1px solid var(--color-border); display: block; }
  .blog-content img.align-center { margin-left: auto; margin-right: auto; }
  .blog-content img.align-left { float: left; margin: var(--space-2) var(--space-5) var(--space-4) 0; max-width: 48%; }
  .blog-content img.align-right { float: right; margin: var(--space-2) 0 var(--space-4) var(--space-5); max-width: 48%; }
  .blog-content figure { margin: var(--space-6) 0; }
  .blog-content figcaption { font-size: var(--text-xs); color: var(--color-ink-faint); text-align: center; margin-top: var(--space-2); font-family: var(--font-mono); }
  
  /* CredBaba special components */
  .summary-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6); margin: var(--space-6) 0; }
  .summary-box h3 { margin-top: 0; color: var(--color-indigo); }
  .blog-cta { background: var(--color-indigo); border-radius: var(--radius-lg); padding: var(--space-8); text-align: center; margin: var(--space-9) 0; color: #fff; }
  .blog-cta h2 { color: #fff; margin-bottom: var(--space-3); margin-top: 0; }
  .blog-cta p { color: rgba(255,255,255,0.85); margin-bottom: var(--space-5); font-size: var(--text-base); }
  .blog-cta .btn { background: #fff; color: var(--color-indigo); font-weight: 600; text-decoration: none; display: inline-block; padding: 12px 24px; border-radius: var(--radius-md); }
  .blog-cta .btn:hover { background: rgba(255,255,255,0.92); }

  /* Accordions */
  .faq-item { border-bottom: 1px solid var(--color-border); }
  .faq-item:first-of-type { border-top: 1px solid var(--color-border); }
  .faq-question { width: 100%; background: none; border: none; text-align: left; padding: var(--space-5) 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); color: var(--color-ink); font-family: var(--font-display); font-size: var(--text-base); font-weight: 600; line-height: 1.4; }
  .faq-question:hover { color: var(--color-indigo); }
  .faq-icon { flex-shrink: 0; width: 20px; height: 20px; transition: transform 0.2s ease; }
  .faq-item.open .faq-icon { transform: rotate(45deg); }
  .faq-answer { display: none; padding-bottom: var(--space-5); color: var(--color-ink-soft); line-height: 1.7; }
  .faq-item.open .faq-answer { display: block; }
  
  .blog-disclaimer { color: var(--color-ink-faint); font-size: var(--text-xs); line-height: 1.6; border-top: 1px solid var(--color-border); padding-top: var(--space-6); margin-top: var(--space-8); }
</style>
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
    <div class="header-actions">
      <a href="../business-loan/" class="btn btn-primary header-cta">Apply Now</a>
      <button class="theme-toggle" data-theme-toggle aria-label="Toggle dark mode" aria-pressed="false">
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      </button>
      <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
  <div class="mobile-menu" id="mobileMenu">
    <a href="../index.html">Home</a>
    <a href="../home-loan/">Home Loan</a>
    <a href="../personal-loan/">Personal Loan</a>
    <a href="../business-loan/">Business Loan</a>
    <a href="index.html">Blog</a>
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

    <p class="blog-disclaimer">The information in this article is for general educational purposes only and does not constitute financial or legal advice. Interest rates, fees and loan terms vary by lender and applicant profile. CredBaba is a digital loan facilitation service (DSA) and does not directly lend money.</p>
  </div>
</main>

<footer class="site-footer">
  <div class="container">
    <div class="ledger-line"></div>
    <div class="footer-bottom">
      <span>© 2026 CredBaba. All rights reserved.</span>
      <span><a href="../pages/loans.html">Explore Loans</a> · <a href="../pages/faq.html">FAQs</a> · <a href="../pages/privacy.html">Privacy</a> · <a href="../pages/terms.html">Terms</a></span>
    </div>
  </div>
</footer>

<script src="../assets/js/theme.js"></script>
<script>
  document.getElementById('navToggle').addEventListener('click', function () {
    var menu = document.getElementById('mobileMenu');
    var open = menu.classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = this.closest('.faq-item');
      var isOpen = item.classList.toggle('open');
      this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });
</script>
</body>
</html>`;
  }

  // Download static HTML file directly in browser
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
    saveBlog,
    deleteBlog,
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
