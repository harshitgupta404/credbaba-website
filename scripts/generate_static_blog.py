import urllib.request
import json
import re

url = "https://script.google.com/macros/s/AKfycbwBskDFL3qYvO5Xg0i9FEcsGig9JJ3Zl44bYbmnQBc9q_cF_AyflphJSLBs7rlr077Y/exec?action=getBlog&slug=home-loan-online-simple-documents"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())

blog = data.get("blog")
if not blog:
    print("Error: blog not returned")
    exit(1)

title = blog["title"]
slug = blog["slug"]
category = blog["category"]
author = blog["author"]
published_at = blog["publishedAt"]
read_time = blog["readTime"]
excerpt = blog["excerpt"]
meta_desc = blog["metaDescription"] or excerpt
content = blog["content"]

# Separate FAQs from main body
faq_idx = content.find("Frequently Asked Questions")
if faq_idx != -1:
    main_body = content[:faq_idx]
    faq_body = content[faq_idx:]
else:
    main_body = content
    faq_body = ""

pattern = r"<h3>(?:<[^>]+>)*\s*([0-9]+\.\s*[^<]+?)(?:<[^>]+>)*\s*<br>\s*(?:<[^>]+>)*\s*([^<]+?)(?:<[^>]+>)*\s*</h3>"
faqs = re.findall(pattern, faq_body, re.DOTALL)

# Clean style tags and empty paragraphs from main_body to make HTML clean and fast
clean_body = re.sub(r"</?span[^>]*>", "", main_body)
clean_body = re.sub(r'style="[^"]*"', '', clean_body)
clean_body = re.sub(r'dir="[^"]*"', '', clean_body)
clean_body = re.sub(r'<p>\s*</p>', '', clean_body)
clean_body = re.sub(r'<h3>\s*</h3>', '', clean_body)
clean_body = re.sub(r'<h2>\s*</h2>', '', clean_body)
clean_body = re.sub(r'<h2>\s*$', '', clean_body.strip())

faq_accordion_html = ""
faq_jsonld_items = []
for q, a in faqs:
    q_clean = q.strip()
    a_clean = a.strip()
    faq_accordion_html += f"""    <div class="faq-item">
      <button class="faq-question" aria-expanded="false">
        {q_clean}
        <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div class="faq-answer">
        <p>{a_clean}</p>
      </div>
    </div>\n"""
    faq_jsonld_items.append({
        "@type": "Question",
        "name": q_clean,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": a_clean
        }
    })

json_ld = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Article",
            "headline": title,
            "description": meta_desc,
            "author": {
                "@type": "Organization",
                "name": author
            },
            "publisher": {
                "@type": "Organization",
                "name": "CredBaba",
                "url": "https://credbaba.com"
            },
            "datePublished": published_at,
            "url": f"https://credbaba.com/blog/{slug}"
        },
        {
            "@type": "FAQPage",
            "mainEntity": faq_jsonld_items
        }
    ]
}

ld_str = json.dumps(json_ld, indent=2, ensure_ascii=False)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<script>
  (function(){{
    var t = localStorage.getItem("credbaba-theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  }})();
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | CredBaba</title>
<meta name="description" content="{meta_desc}">
<link rel="canonical" href="https://credbaba.com/blog/{slug}" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%234338CA%22/><text x=%2250%22 y=%2266%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22%23C9A227%22 font-family=%22monospace%22>C</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/tokens.css">
<link rel="stylesheet" href="../assets/css/site.css">
<script type="application/ld+json">
{ld_str}
</script>
<style>
  .blog-post-header {{ padding: var(--space-9) 0 var(--space-7); max-width: 800px; }}
  .blog-post-header h1 {{ font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl)); margin-bottom: var(--space-4); line-height: 1.2; }}
  .blog-meta {{ color: var(--color-ink-faint); font-size: var(--text-sm); margin-bottom: var(--space-4); }}
  .blog-intro {{ font-size: var(--text-lg); color: var(--color-ink-soft); line-height: 1.7; border-left: 3px solid var(--color-indigo); padding-left: var(--space-5); margin-top: var(--space-5); }}
  .blog-hero-image-wrap {{ max-width: 800px; margin: 0 0 var(--space-8); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md); }}
  .blog-hero-image-wrap img {{ width: 100%; height: auto; max-height: 420px; object-fit: cover; display: block; }}
  .blog-content {{ max-width: 800px; padding-bottom: var(--space-10); }}
  .blog-content h2 {{ font-size: var(--text-2xl); margin-top: var(--space-9); margin-bottom: var(--space-4); }}
  .blog-content h3 {{ font-size: var(--text-xl); margin-top: var(--space-6); margin-bottom: var(--space-3); }}
  .blog-content p {{ color: var(--color-ink-soft); line-height: 1.75; margin-bottom: var(--space-4); }}
  .blog-content ul, .blog-content ol {{ color: var(--color-ink-soft); line-height: 1.75; margin-bottom: var(--space-4); padding-left: 1.5em; }}
  .blog-content li {{ margin-bottom: var(--space-2); }}
  .blog-content strong {{ color: var(--color-ink); }}
  .blog-cta {{ background: var(--color-indigo); border-radius: var(--radius-lg); padding: var(--space-8); text-align: center; margin: var(--space-9) 0; }}
  .blog-cta h2 {{ color: #fff; margin-bottom: var(--space-3); }}
  .blog-cta p {{ color: rgba(255,255,255,0.8); margin-bottom: var(--space-5); }}
  .blog-cta .btn {{ background: #fff; color: var(--color-indigo); }}
  .blog-cta .btn:hover {{ background: rgba(255,255,255,0.9); }}
  .blog-disclaimer {{ color: var(--color-ink-faint); font-size: var(--text-sm); line-height: 1.6; border-top: 1px solid var(--color-border); padding-top: var(--space-6); margin-top: var(--space-8); }}
  .faq-item {{ border-bottom: 1px solid var(--color-border); }}
  .faq-item:first-of-type {{ border-top: 1px solid var(--color-border); }}
  .faq-question {{ width: 100%; background: none; border: none; text-align: left; padding: var(--space-5) 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); color: var(--color-ink); font-family: var(--font-head); font-size: var(--text-base); font-weight: 600; line-height: 1.4; }}
  .faq-question:hover {{ color: var(--color-indigo); }}
  .faq-icon {{ flex-shrink: 0; width: 20px; height: 20px; transition: transform 0.2s ease; }}
  .faq-item.open .faq-icon {{ transform: rotate(45deg); }}
  .faq-answer {{ display: none; padding-bottom: var(--space-5); color: var(--color-ink-soft); line-height: 1.7; }}
  .faq-item.open .faq-answer {{ display: block; }}
  .breadcrumb {{ font-size: var(--text-sm); color: var(--color-ink-faint); margin-bottom: var(--space-5); }}
  .breadcrumb a {{ color: var(--color-indigo); text-decoration: none; }}
  .breadcrumb a:hover {{ text-decoration: underline; }}
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
        <a href="../blog/" class="active">Blog</a>
      </div>
    </nav>
    <div class="header-actions">
      <a href="../home-loan/" class="btn btn-primary header-cta">Apply Now</a>
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
    <a href="../blog/">Blog</a>
  </div>
</header>

<main class="container">

  <div class="blog-post-header">
    <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="../blog/">Blog</a> / {title}</div>
    <div class="eyebrow">{category.upper()} · SEPTEMBER 2026</div>
    <h1>{title}</h1>
    <p class="blog-meta">By {author} &nbsp;·&nbsp; {read_time}</p>
    <p class="blog-intro">{excerpt}</p>
  </div>

  <div class="blog-hero-image-wrap">
    <img src="../assets/images/blog/home-loan-online-simple-documents.webp" alt="{title}" loading="eager" />
  </div>

  <div class="blog-content">

    {clean_body}

    <h2>Frequently Asked Questions (FAQs)</h2>
{faq_accordion_html}

    <div class="blog-cta">
      <h2>Ready to Apply for a Home Loan?</h2>
      <p>Submit your details through CredBaba\'s fast online process and get guided with simple documentation.</p>
      <a href="../home-loan/" class="btn">Apply for a Home Loan →</a>
    </div>

    <p class="blog-disclaimer"><strong>Disclaimer:</strong> This article is for general informational purposes only and should not be construed as financial advice. Interest rates, loan terms, eligibility criteria, and lender offerings are indicative, subject to change, and may vary based on your profile, lender policies, and market conditions. CredBaba is a loan facilitation platform (DSA) and does not itself lend money. Loan approval, interest rates, loan amount, tenure, fees, and all other terms are determined solely by the respective lending partner based on its eligibility criteria and applicable regulations. CredBaba does not guarantee loan approval or any specific rate or term.</p>

  </div>
</main>

<footer class="site-footer">
  <div class="container">
    <div class="ledger-line"></div>
    <div class="footer-bottom">
      <span>© 2026 CredBaba. All rights reserved.</span>
      <span><a href="../blog/">Blog</a> · <a href="../pages/faq.html">FAQs</a> · <a href="../pages/privacy.html">Privacy</a> · <a href="../pages/terms.html">Terms</a></span>
    </div>
  </div>
</footer>

<script src="../assets/js/theme.js"></script>
<script>
  document.getElementById("navToggle").addEventListener("click", function () {{
    var menu = document.getElementById("mobileMenu");
    var open = menu.classList.toggle("open");
    this.setAttribute("aria-expanded", open ? "true" : "false");
  }});
</script>
<script>
  document.querySelectorAll(".faq-question").forEach(function(btn) {{
    btn.addEventListener("click", function() {{
      var item = this.closest(".faq-item");
      var isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function(el) {{
        el.classList.remove("open");
        el.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      }});
      if (!isOpen) {{
        item.classList.add("open");
        this.setAttribute("aria-expanded", "true");
      }}
    }});
  }});
</script>
</body>
</html>
"""

with open("blog/home-loan-online-simple-documents.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Generated blog/home-loan-online-simple-documents.html successfully! Size:", len(html))
