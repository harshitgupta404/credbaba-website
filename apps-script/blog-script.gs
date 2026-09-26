// ==========================================================================
// CredBaba: Blog Management Google Apps Script
// Bound to a Google Sheet named "CredBaba Blogs"
// Handles saving, listing, and syncing published blog articles.
// ==========================================================================

const SHEET_NAME = 'CredBaba Blogs';

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || 'saveBlog';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Initialize headers
      sheet.appendRow([
        'ID',
        'Title',
        'Slug',
        'Category',
        'Author',
        'Published Date',
        'Read Time',
        'Excerpt',
        'Hero Image',
        'Content',
        'Status',
        'Updated At'
      ]);
    }

    if (action === 'saveBlog') {
      const b = payload.blog || {};
      const data = sheet.getDataRange().getValues();
      let foundRow = -1;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === b.id || data[i][2] === b.slug) {
          foundRow = i + 1;
          break;
        }
      }

      const rowValues = [
        b.id || Utilities.getUuid(),
        b.title || '',
        b.slug || '',
        b.category || '',
        b.author || '',
        b.publishedAt || new Date().toISOString().split('T')[0],
        b.readTime || '',
        b.excerpt || '',
        b.heroImage || '',
        b.content || '',
        b.status || 'published',
        new Date().toISOString()
      ];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({ result: 'success', blog: b }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getBlogs') {
      const data = sheet.getDataRange().getValues();
      const blogs = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        blogs.push({
          id: row[0],
          title: row[1],
          slug: row[2],
          category: row[3],
          author: row[4],
          publishedAt: row[5],
          readTime: row[6],
          excerpt: row[7],
          heroImage: row[8],
          content: row[9],
          status: row[10],
          updatedAt: row[11]
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', blogs: blogs }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return doPost(e);
}
