const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .csv, .xls, and .xlsx files are accepted.'));
    }
  },
});

const CATEGORY_KEYWORDS = {
  Groceries: ['checkers', 'pick n pay', 'woolworths food', 'spar', 'shoprite', 'food lover'],
  Transport: ['engen', 'shell', 'bp ', 'caltex', 'uber', 'bolt', 'fuel', 'petrol', 'parking'],
  'Dining out': ['restaurant', 'cafe', 'coffee', 'kfc', 'mcdonalds', 'steers', 'nandos', 'debonairs', 'vida'],
  Utilities: ['eskom', 'electricity', 'water', 'telkom', 'vodacom', 'mtn ', 'cell c', 'rain '],
  Subscriptions: ['netflix', 'dstv', 'spotify', 'amazon', 'apple', 'google'],
  Health: ['dis-chem', 'clicks pharmacy', 'gym', 'virgin active', 'mediclinic', 'netcare'],
  Housing: ['rent', 'levy', 'rates', 'bond', 'maintenance'],
  Income: ['salary', 'payroll', 'transfer in', 'payment received'],
};

function detectBank(headers) {
  const headerStr = headers.join(' ').toLowerCase();
  if (headerStr.includes('service fees')) return 'FNB';
  if (headerStr.includes('credit amount') || headerStr.includes('debit amount')) return 'Standard Bank';
  if (headerStr.includes('running balance')) {
    if (headerStr.includes('debit') && headerStr.includes('credit')) return 'Nedbank';
  }
  // Capitec tends to have: Date, Description, Debit, Credit, Balance
  if (headerStr.includes('debit') && headerStr.includes('credit') && headerStr.includes('balance')) {
    if (!headerStr.includes('running') && !headerStr.includes('service')) return 'Capitec';
  }
  return 'Unknown';
}

function autoDetectColumnMap(headers) {
  const map = { date: null, name: null, amount: null, category: null };
  const lowerHeaders = headers.map(h => ({ original: h, lower: h.toLowerCase() }));

  for (const h of lowerHeaders) {
    if (h.lower.includes('date')) map.date = h.original;
    else if (['amount', 'debit', 'credit', 'value'].some(k => h.lower.includes(k))) {
      // Prefer "amount" over debit/credit
      if (h.lower.includes('amount') && !h.lower.includes('debit amount') && !h.lower.includes('credit amount')) {
        map.amount = h.original;
      } else if (!map.amount) {
        map.amount = h.original;
      }
    }
    else if (['description', 'narrative', 'details', 'reference', 'payee'].some(k => h.lower.includes(k))) {
      map.name = h.original;
    }
    else if (h.lower.includes('category')) map.category = h.original;
  }

  return map;
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    let [, a, b, y] = slashMatch;
    // If first part > 12, it's definitely day
    if (parseInt(a) > 12) {
      return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
    // Assume DD/MM (SA format)
    return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
  }

  // DD Mon YYYY e.g. "15 Jun 2026"
  const monMatch = str.match(/^(\d{1,2})\s+(\w{3,9})\s+(\d{4})$/);
  if (monMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const monthNum = months[monMatch[2].toLowerCase().substring(0, 3)];
    if (monthNum) {
      return `${monMatch[3]}-${monthNum}-${String(monMatch[1]).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseAmount(value) {
  if (value === undefined || value === null) return NaN;
  let str = String(value).trim();
  // Remove currency symbols, spaces, commas used as thousand separators
  str = str.replace(/[R$£\s]/g, '').replace(/,/g, '');
  // Handle parenthetical negatives: (450.00) -> -450.00
  const parenMatch = str.match(/^\(([\d.]+)\)$/);
  if (parenMatch) return -parseFloat(parenMatch[1]);
  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function autoAssignCategory(name) {
  if (!name) return 'Other';
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return 'Other';
}

function parseRows(headers, dataRows, columnMap, detectedBank) {
  const rows = [];
  const dateIdx = headers.indexOf(columnMap.date);
  const nameIdx = headers.indexOf(columnMap.name);
  const amountIdx = headers.indexOf(columnMap.amount);
  const categoryIdx = columnMap.category ? headers.indexOf(columnMap.category) : -1;

  // Check if there are separate debit/credit columns
  const debitIdx = headers.findIndex(h => h.toLowerCase().includes('debit') && !h.toLowerCase().includes('debit amount'));
  const creditIdx = headers.findIndex(h => h.toLowerCase().includes('credit') && !h.toLowerCase().includes('credit amount'));
  const debitAmountIdx = headers.findIndex(h => h.toLowerCase() === 'debit amount');
  const creditAmountIdx = headers.findIndex(h => h.toLowerCase() === 'credit amount');
  const hasSplitColumns = (debitIdx >= 0 || debitAmountIdx >= 0) && (creditIdx >= 0 || creditAmountIdx >= 0);

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i];
    const id = `row-${i}`;

    let date = null;
    let name = null;
    let amount = NaN;
    let category = null;

    // Date
    if (dateIdx >= 0) date = parseDate(raw[dateIdx]);

    // Name
    if (nameIdx >= 0) name = String(raw[nameIdx] || '').trim();

    // Amount — handle split debit/credit columns
    if (hasSplitColumns) {
      const dIdx = debitAmountIdx >= 0 ? debitAmountIdx : debitIdx;
      const cIdx = creditAmountIdx >= 0 ? creditAmountIdx : creditIdx;
      const debitVal = dIdx >= 0 ? parseAmount(raw[dIdx]) : 0;
      const creditVal = cIdx >= 0 ? parseAmount(raw[cIdx]) : 0;
      if (!isNaN(creditVal) && creditVal !== 0) {
        amount = creditVal;
      } else if (!isNaN(debitVal) && debitVal !== 0) {
        amount = -Math.abs(debitVal);
      } else {
        amount = 0;
      }
    } else if (amountIdx >= 0) {
      amount = parseAmount(raw[amountIdx]);
    }

    // Category
    if (categoryIdx >= 0 && raw[categoryIdx]) {
      category = String(raw[categoryIdx]).trim();
    }
    if (!category) {
      category = autoAssignCategory(name);
    }

    const valid = date !== null && !isNaN(amount) && name && name.length > 0;
    let error = null;
    if (!valid) {
      if (!date) error = 'Unparseable date';
      else if (isNaN(amount)) error = 'Invalid amount';
      else if (!name) error = 'Missing description';
    }

    rows.push({ id, date, name, amount: isNaN(amount) ? 0 : amount, category, notes: '', valid, error });
  }

  return rows;
}

// POST /api/import/preview
router.post('/preview', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const buffer = req.file.buffer;
      const mimetype = req.file.mimetype;
      let headers = [];
      let dataRows = [];

      if (mimetype === 'text/csv') {
        const parsed = parse(buffer.toString('utf-8'), {
          columns: false,
          skip_empty_lines: true,
          relax_column_count: true,
        });
        if (parsed.length < 2) {
          return res.status(400).json({ error: 'CSV file has no data rows.' });
        }
        headers = parsed[0].map(h => String(h).trim());
        dataRows = parsed.slice(1).map(row => row.map(c => String(c).trim()));
      } else {
        // Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (jsonData.length < 2) {
          return res.status(400).json({ error: 'Excel file has no data rows.' });
        }
        headers = jsonData[0].map(h => String(h).trim());
        dataRows = jsonData.slice(1).map(row => row.map(c => String(c).trim()));
      }

      // Filter out completely empty rows
      dataRows = dataRows.filter(row => row.some(c => c && c.length > 0));

      if (dataRows.length === 0) {
        return res.status(400).json({ error: 'No data rows found in file.' });
      }

      const detectedBank = detectBank(headers);
      const columnMap = autoDetectColumnMap(headers);

      // If amount not found, check for split debit/credit columns
      if (!columnMap.amount) {
        const debitCol = headers.find(h => h.toLowerCase().includes('debit'));
        const creditCol = headers.find(h => h.toLowerCase().includes('credit'));
        if (debitCol || creditCol) {
          columnMap.amount = debitCol || creditCol;
        }
      }

      const rows = parseRows(headers, dataRows, columnMap, detectedBank);

      const validCount = rows.filter(r => r.valid).length;
      const invalidCount = rows.filter(r => !r.valid).length;

      res.json({
        rows,
        summary: {
          total: rows.length,
          valid: validCount,
          invalid: invalidCount,
          detectedBank,
        },
        columnMap: {
          date: columnMap.date,
          name: columnMap.name,
          amount: columnMap.amount,
          category: columnMap.category,
        },
      });
    } catch (parseErr) {
      console.error('Preview parse error:', parseErr);
      res.status(400).json({ error: 'Failed to parse file. Please check the format and try again.' });
    }
  });
});

/**
 * Helper: resolve category_id from category name for the user.
 * Falls back to null if no matching category found.
 */
async function resolveCategoryId(userId, categoryName) {
  if (!categoryName) return null;
  const result = await pool.query(
    'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND is_active = TRUE LIMIT 1',
    [userId, categoryName]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// POST /api/import/confirm
router.post('/confirm', async (req, res) => {
  const { rows } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No transactions to import.' });
  }

  const validRows = rows.filter(r => r.valid && r.selected !== false);
  if (validRows.length === 0) {
    return res.status(400).json({ error: 'No valid transactions selected for import.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let imported = 0;
    let skipped = 0;

    for (const row of validRows) {
      // Deduplication: check if same date + name + amount exists
      const dup = await client.query(
        'SELECT id FROM transactions WHERE user_id = $1 AND date = $2 AND name = $3 AND amount = $4',
        [req.user.id, row.date, row.name, row.amount]
      );

      if (dup.rows.length > 0) {
        skipped++;
        continue;
      }

      // Resolve category_id from the assigned category name
      const categoryId = await resolveCategoryId(req.user.id, row.category);

      await client.query(
        'INSERT INTO transactions (user_id, name, amount, category, category_id, date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [req.user.id, row.name, row.amount, row.category || 'Other', categoryId, row.date, row.notes || null]
      );
      imported++;
    }

    await client.query('COMMIT');
    res.json({ imported, skipped });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import confirm error:', err);
    res.status(500).json({ error: 'Failed to import transactions.' });
  } finally {
    client.release();
  }
});

module.exports = router;