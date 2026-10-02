// ==========================================================================
// CredBaba: Blog & Backoffice Management Google Apps Script (Option 1)
// Container-bound to a Google Sheet named "CredBaba Blogs"
// Manages:
//   1. Real-time blog publishing, status toggles (draft/published), deletions
//   2. Multi-user backoffice authentication, roles, and synchronization
// ==========================================================================

// Set your Google Sheet ID below ONLY if deploying as a standalone script from script.google.com.
// If created inside Google Sheets via Extensions -> Apps Script, leave this empty.
const SPREADSHEET_ID = '';
const SHEET_NAME_BLOGS = 'CredBaba Blogs';
const SHEET_NAME_USERS = 'CredBaba Users';

function getSpreadsheet() {
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID && SPREADSHEET_ID.trim()) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (e) {}
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return null;
  }
}

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

    const action = payload.action || params.action || 'ping';
    const ss = getSpreadsheet();
    if (!ss) {
      return jsonResponse({
        result: 'error',
        message: 'Script is not attached to a spreadsheet. Either open from Google Sheets -> Extensions -> Apps Script, or set SPREADSHEET_ID in blog-script.gs.'
      });
    }

    // ACTION: ping (Health check)
    if (action === 'ping' || action === 'status') {
      return jsonResponse({
        result: 'success',
        status: 'online',
        service: 'CredBaba Blog & User Cloud API',
        spreadsheet: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // ========================================================================
    // USER AUTHENTICATION & MANAGEMENT ACTIONS
    // ========================================================================

    // ACTION: authenticate (Verify credentials across any browser/device)
    if (action === 'authenticate') {
      const username = (payload.username || params.username || '').toString().trim().toLowerCase();
      const passHash = (payload.passwordHash || params.passwordHash || '').toString().trim();

      if (!username || !passHash) {
        return jsonResponse({ result: 'error', reason: 'EMPTY', message: 'Missing username or password hash.' });
      }

      // Fast check for primary super administrator credentials
      if ((username === 'admin' || username === 'credbaba_admin') && passHash === 'b99905801b4a6f74bec41a53623d5f9206c158b73a668b418bf01de49fa8a952') {
        return jsonResponse({
          result: 'success',
          user: {
            username: 'admin',
            name: 'Primary Administrator',
            role: 'Super Admin',
            status: 'active',
            isPrimary: true
          }
        });
      }

      const uSheet = getUsersSheet(ss);
      const data = uSheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowUser = (row[0] || '').toString().trim().toLowerCase();
        const isPrimary = Boolean(row[6]);

        if (rowUser === username || (isPrimary && username === 'credbaba_admin')) {
          const status = (row[4] || 'active').toString().toLowerCase().trim();
          if (status === 'suspended') {
            return jsonResponse({ result: 'error', reason: 'SUSPENDED', message: 'This user account is suspended.' });
          }

          const expectedHash = (row[3] || '').toString().trim();
          if (expectedHash === passHash) {
            return jsonResponse({
              result: 'success',
              user: {
                username: row[0],
                name: row[1] || row[0],
                role: row[2] || 'Marketing Editor',
                status: status,
                isPrimary: isPrimary
              }
            });
          } else {
            return jsonResponse({ result: 'error', reason: 'INVALID', message: 'Invalid password.' });
          }
        }
      }

      return jsonResponse({ result: 'error', reason: 'NOT_FOUND', message: 'User does not exist.' });
    }

    // ACTION: getUsers (Retrieve registered backoffice users)
    if (action === 'getUsers') {
      const uSheet = getUsersSheet(ss);
      const data = uSheet.getDataRange().getValues();
      const users = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const u = (row[0] || '').toString().trim();
        if (u) {
          users.push({
            username: u,
            name: row[1] || u,
            role: row[2] || 'Marketing Editor',
            status: (row[4] || 'active').toString().trim(),
            createdAt: row[5] || '',
            isPrimary: Boolean(row[6]),
            lastUpdated: row[7] || ''
          });
        }
      }

      return jsonResponse({ result: 'success', users: users, total: users.length });
    }

    // ACTION: saveUser (Create or update backoffice user)
    if (action === 'saveUser') {
      const u = payload.user || payload;
      const username = (u.username || params.username || '').toString().trim().toLowerCase();
      if (!username) {
        return jsonResponse({ result: 'error', message: 'Missing username.' });
      }

      const uSheet = getUsersSheet(ss);
      const data = uSheet.getDataRange().getValues();
      let foundRow = -1;

      for (let i = 1; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim().toLowerCase() === username) {
          foundRow = i + 1;
          break;
        }
      }

      const now = new Date().toISOString();
      const isPrimary = username === 'admin' || (foundRow > 0 && Boolean(data[foundRow - 1][6]));

      if (foundRow > 0) {
        // Update existing user
        const existingPassHash = data[foundRow - 1][3];
        const newPassHash = (u.passwordHash || params.passwordHash) ? (u.passwordHash || params.passwordHash).toString().trim() : existingPassHash;
        const existingCreatedAt = data[foundRow - 1][5];

        const updatedRow = [
          data[foundRow - 1][0], // keep username casing
          u.name !== undefined ? u.name : (params.name !== undefined ? params.name : data[foundRow - 1][1]),
          u.role !== undefined ? u.role : (params.role !== undefined ? params.role : data[foundRow - 1][2]),
          newPassHash,
          u.status !== undefined ? u.status : (params.status !== undefined ? params.status : data[foundRow - 1][4]),
          existingCreatedAt,
          isPrimary,
          now
        ];

        uSheet.getRange(foundRow, 1, 1, updatedRow.length).setValues([updatedRow]);
        return jsonResponse({ result: 'success', message: 'User updated successfully.', username: username });
      } else {
        // Insert new user
        const passHash = (u.passwordHash || params.passwordHash || '').toString().trim();
        if (!passHash) {
          return jsonResponse({ result: 'error', message: 'Password hash is required for new users.' });
        }

        const newRow = [
          username,
          u.name || params.name || username,
          u.role || params.role || 'Marketing Editor',
          passHash,
          u.status || params.status || 'active',
          now,
          false,
          now
        ];

        uSheet.appendRow(newRow);
        return jsonResponse({ result: 'success', message: 'User created successfully.', username: username });
      }
    }

    // ACTION: deleteUser (Delete backoffice user)
    if (action === 'deleteUser') {
      const targetUser = (payload.username || params.username || '').toString().trim().toLowerCase();
      if (!targetUser) {
        return jsonResponse({ result: 'error', message: 'Missing username to delete.' });
      }
      if (targetUser === 'admin') {
        return jsonResponse({ result: 'error', message: 'Primary administrator cannot be deleted.' });
      }

      const uSheet = getUsersSheet(ss);
      const data = uSheet.getDataRange().getValues();
      let deleted = false;

      for (let i = data.length - 1; i >= 1; i--) {
        const rowUser = (data[i][0] || '').toString().trim().toLowerCase();
        const isPrimary = Boolean(data[i][6]);

        if (rowUser === targetUser) {
          if (isPrimary) {
            return jsonResponse({ result: 'error', message: 'Primary administrator cannot be deleted.' });
          }
          uSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      return jsonResponse({ result: 'success', deleted: deleted, username: targetUser });
    }

    // ========================================================================
    // BLOG MANAGEMENT ACTIONS
    // ========================================================================
    let sheet = getBlogsSheet(ss);

    // ACTION: getBlogs (Used by public website credbaba.com/blog/)
    // Returns ONLY blogs with Status === 'published'
    if (action === 'getBlogs') {
      const data = sheet.getDataRange().getValues();
      const blogs = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = (row[12] || '').toString().toLowerCase().trim();

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

    // ACTION: getBlog (Used by public reader credbaba.com/blog/<slug>)
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

    // ACTION: getAllBlogs (Used by Backoffice blogs.html table)
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

    // ACTION: saveBlog (Save Draft or Publish from Backoffice)
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

    // ACTION: deleteBlog (Deletes blog row from Sheet)
    if (action === 'deleteBlog') {
      const targetSlug = (payload.slug || params.slug || '').toString().toLowerCase().trim();
      const targetId = (payload.id || params.id || '').toString().trim();

      if (!targetSlug && !targetId) {
        return jsonResponse({ result: 'error', message: 'Missing slug or id to delete' });
      }

      const data = sheet.getDataRange().getValues();
      let deleted = false;

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

function getBlogsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME_BLOGS);
  if (!sheet) {
    const sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() <= 1) {
      sheet = sheets[0];
      sheet.setName(SHEET_NAME_BLOGS);
    } else {
      sheet = ss.insertSheet(SHEET_NAME_BLOGS);
    }
  }

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
  return sheet;
}

function getUsersSheet(ss) {
  let uSheet = ss.getSheetByName(SHEET_NAME_USERS);
  if (!uSheet) {
    uSheet = ss.insertSheet(SHEET_NAME_USERS);
  }

  if (uSheet.getLastRow() === 0) {
    uSheet.appendRow([
      'Username',
      'Name',
      'Role',
      'PasswordHash',
      'Status',
      'CreatedAt',
      'IsPrimary',
      'LastUpdated'
    ]);
    uSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#F3E8FF').setFontColor('#6B21A8');
    uSheet.setFrozenRows(1);

    // Default Super Admin
    uSheet.appendRow([
      'admin',
      'Primary Administrator',
      'Super Admin',
      'b99905801b4a6f74bec41a53623d5f9206c158b73a668b418bf01de49fa8a952',
      'active',
      new Date().toISOString(),
      true,
      ''
    ]);
  }
  return uSheet;
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
