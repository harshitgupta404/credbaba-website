// ==========================================================================
// CredBaba: Blog Management Google Apps Script (Option 1)
// Container-bound to a Google Sheet named "CredBaba Blogs"
// Manages real-time blog publishing, status toggles (draft/published),
// deletions, and instant website retrieval without any git commits.
// ==========================================================================

const SHEET_NAME = 'CredBaba Blogs';

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    let params = (e && e.parameter) || {};
    let payload = {};

    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = {};
      }
    }

    const action = payload.action || params.action || 'getBlogs';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({ result: 'error', message: 'Script is not attached to a spreadsheet. Open from Extensions -> Apps Script inside Google Sheets.' });
    }

    let sheet = ss.getSheetByName(SHEET_NAME);

    // If "CredBaba Blogs" doesn't exist, check if Sheet1 can be used/renamed
    if (!sheet) {
      const sheets = ss.getSheets();
      if (sheets.length === 1 && sheets[0].getLastRow() <= 1) {
        sheet = sheets[0];
        sheet.setName(SHEET_NAME);
      } else {
        sheet = ss.insertSheet(SHEET_NAME);
      }
    }

    // Set up headers if newly created
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'ID',
        'Title',
        'Slug',
        'Category',
        'Author',
        'Published Date',
        'Read Time',
        'Excerpt',
        'Meta Description',
        'Hero Image',
        'Content',
        'FAQs',
        'Status',
        'Updated At'
      ]);
      sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#E0E7FF').setFontColor('#3730A3');
      sheet.setFrozenRows(1);
    }

    // ------------------------------------------------------------------------
    // ACTION: getBlogs (Used by public website credbaba.com/blog/)
    // Returns ONLY blogs with Status === 'published'
    // ------------------------------------------------------------------------
    if (action === 'getBlogs') {
      const data = sheet.getDataRange().getValues();
      const blogs = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = (row[12] || '').toString().toLowerCase().trim();

        // STRICT FILTER: Only return published articles to public website
        if (status === 'published') {
          let faqs = [];
          try {
            if (row[11]) faqs = JSON.parse(row[11]);
          } catch (err) {}

          blogs.push({
            id: row[0],
            title: row[1],
            slug: row[2],
            category: row[3],
            author: row[4],
            publishedAt: formatDate(row[5]),
            readTime: row[6],
            excerpt: row[7],
            metaDescription: row[8],
            heroImage: row[9],
            content: row[10],
            faqs: faqs,
            status: 'published',
            updatedAt: row[13]
          });
        }
      }

      return jsonResponse({ result: 'success', blogs: blogs, total: blogs.length });
    }

    // ------------------------------------------------------------------------
    // ACTION: getBlog (Used by public reader credbaba.com/blog/post.html?slug=...)
    // Returns the article ONLY if Status === 'published' (or preview=1)
    // ------------------------------------------------------------------------
    if (action === 'getBlog') {
      const slug = (params.slug || payload.slug || '').toString().toLowerCase().trim();
      const id = (params.id || payload.id || '').toString().trim();
      const includeDraft = params.preview === '1' || payload.preview === '1';

      if (!slug && !id) {
        return jsonResponse({ result: 'error', message: 'Missing slug or id parameter' });
      }

      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowId = (row[0] || '').toString().trim();
        const rowSlug = (row[2] || '').toString().toLowerCase().trim();
        const status = (row[12] || '').toString().toLowerCase().trim();

        if (rowSlug === slug || (id && rowId === id)) {
          // If status is not published and preview is not requested, return not_found
          if (status !== 'published' && !includeDraft) {
            return jsonResponse({
              result: 'not_found',
              message: 'Article is currently unpublished or in draft.'
            });
          }

          let faqs = [];
          try {
            if (row[11]) faqs = JSON.parse(row[11]);
          } catch (err) {}

          return jsonResponse({
            result: 'success',
            blog: {
              id: row[0],
              title: row[1],
              slug: row[2],
              category: row[3],
              author: row[4],
              publishedAt: formatDate(row[5]),
              readTime: row[6],
              excerpt: row[7],
              metaDescription: row[8],
              heroImage: row[9],
              content: row[10],
              faqs: faqs,
              status: status,
              updatedAt: row[13]
            }
          });
        }
      }

      return jsonResponse({ result: 'not_found', message: 'Article not found' });
    }

    // ------------------------------------------------------------------------
    // ACTION: getAllBlogs (Used by Backoffice blogs.html table)
    // Returns all blogs (Drafts + Published)
    // ------------------------------------------------------------------------
    if (action === 'getAllBlogs') {
      const data = sheet.getDataRange().getValues();
      const blogs = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let faqs = [];
        try {
          if (row[11]) faqs = JSON.parse(row[11]);
        } catch (err) {}

        blogs.push({
          id: row[0],
          title: row[1],
          slug: row[2],
          category: row[3],
          author: row[4],
          publishedAt: formatDate(row[5]),
          readTime: row[6],
          excerpt: row[7],
          metaDescription: row[8],
          heroImage: row[9],
          content: row[10],
          faqs: faqs,
          status: (row[12] || 'draft').toString().toLowerCase().trim(),
          updatedAt: row[13]
        });
      }

      return jsonResponse({ result: 'success', blogs: blogs, total: blogs.length });
    }

    // ------------------------------------------------------------------------
    // ACTION: saveBlog (Save Draft or Publish from Backoffice)
    // Inserts or updates row by ID or slug
    // ------------------------------------------------------------------------
    if (action === 'saveBlog') {
      const b = payload.blog || payload;
      if (!b.title || !b.slug) {
        return jsonResponse({ result: 'error', message: 'Missing title or slug' });
      }

      const data = sheet.getDataRange().getValues();
      let foundRow = -1;

      const targetId = (b.id || '').toString().trim();
      const targetSlug = (b.slug || '').toString().toLowerCase().trim();

      for (let i = 1; i < data.length; i++) {
        const rowId = (data[i][0] || '').toString().trim();
        const rowSlug = (data[i][2] || '').toString().toLowerCase().trim();

        if ((targetId && rowId === targetId) || (targetSlug && rowSlug === targetSlug)) {
          foundRow = i + 1;
          break;
        }
      }

      const blogStatus = (b.status || 'published').toString().toLowerCase().trim();

      const rowValues = [
        b.id || Utilities.getUuid(),
        b.title || '',
        b.slug || '',
        b.category || 'Loan Guide',
        b.author || 'CredBaba Editorial Team',
        b.publishedAt || new Date().toISOString().split('T')[0],
        b.readTime || '5 min read',
        b.excerpt || '',
        b.metaDescription || b.excerpt || b.title || '',
        b.heroImage || '',
        b.content || '',
        JSON.stringify(b.faqs || []),
        blogStatus,
        new Date().toISOString()
      ];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return jsonResponse({
        result: 'success',
        blog: b,
        status: blogStatus,
        row: foundRow > 0 ? foundRow : sheet.getLastRow()
      });
    }

    // ------------------------------------------------------------------------
    // ACTION: deleteBlog (Deletes row from Sheet completely)
    // ------------------------------------------------------------------------
    if (action === 'deleteBlog') {
      const targetSlug = (payload.slug || params.slug || '').toString().toLowerCase().trim();
      const targetId = (payload.id || params.id || '').toString().trim();

      if (!targetSlug && !targetId) {
        return jsonResponse({ result: 'error', message: 'Missing slug or id to delete' });
      }

      const data = sheet.getDataRange().getValues();
      let deleted = false;

      // Iterate backwards so row indexes remain valid during deletion
      for (let i = data.length - 1; i >= 1; i--) {
        const rowId = (data[i][0] || '').toString().trim();
        const rowSlug = (data[i][2] || '').toString().toLowerCase().trim();

        if ((targetId && rowId === targetId) || (targetSlug && rowSlug === targetSlug)) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      return jsonResponse({ result: 'success', deleted: deleted, target: targetSlug || targetId });
    }

    return jsonResponse({ result: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ result: 'error', message: err.toString() });
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return val.toString();
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
