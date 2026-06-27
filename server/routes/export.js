const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/export/report?month=2026-06
router.get('/report', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    const userId = req.user.id;

    // Fetch all data in parallel
    const [txnResult, budgetResult, goalResult, assetResult] = await Promise.all([
      pool.query(
        `SELECT * FROM transactions WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2 ORDER BY date DESC, created_at DESC`,
        [userId, month]
      ),
      pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM assets WHERE user_id = $1', [userId]),
    ]);

    const transactions = txnResult.rows;
    const budgets = budgetResult.rows;
    const goals = goalResult.rows;
    const assets = assetResult.rows;

    // Calculate summary
    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    // Net worth — mirrors the logic in networthService.js (Math.abs on liabilities
    // because values may be stored as negative numbers in the database)
    const totalAssets = assets
      .filter(a => a.type === 'asset')
      .reduce((sum, a) => sum + parseFloat(a.value), 0);
    const totalLiabilities = assets
      .filter(a => a.type === 'liability')
      .reduce((sum, a) => sum + Math.abs(parseFloat(a.value)), 0);
    const netWorth = totalAssets - totalLiabilities;

    // Spending by category
    const categorySpending = {};
    transactions.forEach(t => {
      if (t.amount < 0) {
        const cat = t.category || 'Other';
        if (!categorySpending[cat]) categorySpending[cat] = 0;
        categorySpending[cat] += Math.abs(parseFloat(t.amount));
      }
    });

    // Month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [year, monthNum] = month.split('-');
    const monthName = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

    // ── PDF setup ──────────────────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      autoFirstPage: true,
      info: {
        Title: `FinanceIQ Monthly Report - ${monthName}`,
        Author: 'FinanceIQ',
        Subject: 'Personal Finance Report',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FinanceIQ-Report-${month}.pdf"`);
    doc.pipe(res);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const PAGE_H = doc.page.height;   // 841.89
    const PAGE_W = doc.page.width;    // 595.28
    const MARGIN_L = 60;
    const CONTENT_W = PAGE_W - MARGIN_L * 2;
    const BOTTOM_MARGIN = 60;         // space reserved for footer

    const fmt = (val) => {
      const abs = Math.abs(val);
      const sign = val < 0 ? '-' : '';
      const parts = abs.toFixed(2).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${sign}R${parts[0]}.${parts[1]}`;
    };

    // curY tracks the current drawing position explicitly, so page breaks are precise.
    let curY = 0;

    const addFooter = () => {
      doc.fontSize(8).fillColor('#aaa')
        .text(`FinanceIQ · ${monthName} Report`, MARGIN_L, PAGE_H - 35, { width: CONTENT_W / 2 })
        .text(`Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
          PAGE_W / 2, PAGE_H - 35, { width: CONTENT_W / 2, align: 'right' });
    };

    // Ensure there is at least `needed` vertical space. If not, start a new page.
    const ensureSpace = (needed) => {
      if (curY + needed > PAGE_H - BOTTOM_MARGIN) {
        addFooter();
        doc.addPage();
        curY = 50;
      }
    };

    // Draw a section heading, respecting page breaks.
    const sectionHeading = (text, fontSize = 13) => {
      ensureSpace(30);
      doc.fontSize(fontSize).fillColor('#222').font('Helvetica-Bold').text(text, MARGIN_L, curY);
      curY += fontSize + 10;
    };

    // Draw a simple two-column key/value row.
    const kvRow = (label, value, valueColor = '#333') => {
      ensureSpace(20);
      doc.fontSize(10).fillColor('#555').font('Helvetica').text(label, MARGIN_L, curY, { width: 250 });
      doc.fontSize(10).fillColor(valueColor).font('Helvetica-Bold')
        .text(value, MARGIN_L + 250, curY, { width: CONTENT_W - 250, align: 'right' });
      curY += 20;
    };

    // ── PAGE 1 — Cover & Summary ───────────────────────────────────────────────

    // Header bar
    doc.rect(0, 0, PAGE_W, 80).fill('#0D0F14');
    doc.fontSize(28).fillColor('#00C896').font('Helvetica-Bold').text('FinanceIQ', MARGIN_L, 22);
    doc.fontSize(10).fillColor('#888').font('Helvetica').text('Personal Finance Intelligence', MARGIN_L, 56);

    curY = 100;

    // Report title
    doc.fontSize(22).fillColor('#333').font('Helvetica-Bold').text('Monthly Financial Report', MARGIN_L, curY);
    curY += 30;
    doc.fontSize(14).fillColor('#666').font('Helvetica').text(monthName, MARGIN_L, curY);
    curY += 20;
    doc.fontSize(9).fillColor('#999').font('Helvetica')
      .text(`Generated on ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN_L, curY);
    curY += 30;

    // Summary box
    const summaryBoxH = 130;
    ensureSpace(summaryBoxH + 10);
    doc.rect(MARGIN_L, curY, CONTENT_W, summaryBoxH).fill('#F5F7FA');
    doc.fontSize(11).fillColor('#333').font('Helvetica-Bold').text('SUMMARY', MARGIN_L + 20, curY + 12);
    curY += 30;

    const summaryItems = [
      { label: 'Total Income',   value: fmt(totalIncome),   color: '#00C896' },
      { label: 'Total Expenses', value: fmt(totalExpenses), color: '#FF5C5C' },
      { label: 'Net Savings',    value: fmt(netSavings),    color: netSavings >= 0 ? '#00C896' : '#FF5C5C' },
      { label: 'Savings Rate',   value: `${savingsRate}%`,  color: '#4D9FFF' },
      { label: 'Net Worth',      value: fmt(netWorth),      color: netWorth >= 0 ? '#00C896' : '#FF5C5C' },
    ];
    summaryItems.forEach(item => {
      doc.fontSize(10).fillColor('#555').font('Helvetica').text(item.label, MARGIN_L + 20, curY);
      doc.fontSize(10).fillColor(item.color).font('Helvetica-Bold')
        .text(item.value, MARGIN_L + 20, curY, { width: CONTENT_W - 40, align: 'right' });
      curY += 20;
    });
    curY += 16;

    // ── Spending by category table ─────────────────────────────────────────────
    const categories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);

    if (categories.length > 0) {
      ensureSpace(50);
      sectionHeading('SPENDING BY CATEGORY', 11);

      // Table header row
      ensureSpace(22);
      doc.rect(MARGIN_L, curY, CONTENT_W, 20).fill('#EDF0F5');
      doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
      doc.text('Category',  MARGIN_L + 8,       curY + 5, { width: 150 });
      doc.text('Spent',     MARGIN_L + 158,      curY + 5, { width: 90, align: 'right' });
      doc.text('Budget',    MARGIN_L + 258,      curY + 5, { width: 90, align: 'right' });
      doc.text('Status',    MARGIN_L + 358,      curY + 5, { width: CONTENT_W - 366 });
      curY += 22;

      categories.forEach(([cat, spent], i) => {
        ensureSpace(22);
        if (i % 2 === 0) doc.rect(MARGIN_L, curY, CONTENT_W, 20).fill('#FAFBFC');

        const budget = budgets.find(b => b.category === cat);
        const budgetAmount = budget ? parseFloat(budget.monthly_limit) : 0;
        const pctUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : null;
        let status = budgetAmount === 0 ? 'No budget' : '';
        let statusColor = '#888';
        if (pctUsed !== null) {
          if (pctUsed > 100)      { status = `⚠ Over (${pctUsed}%)`;  statusColor = '#FF5C5C'; }
          else if (pctUsed === 100) { status = `⚠ At limit`;           statusColor = '#FFAB2E'; }
          else                    { status = `✓ ${pctUsed}% used`;    statusColor = '#00C896'; }
        }

        doc.fontSize(9).fillColor('#333').font('Helvetica');
        doc.text(cat,                              MARGIN_L + 8,  curY + 4, { width: 150 });
        doc.text(fmt(spent),                       MARGIN_L + 158, curY + 4, { width: 90, align: 'right' });
        doc.text(budgetAmount > 0 ? fmt(budgetAmount) : '—', MARGIN_L + 258, curY + 4, { width: 90, align: 'right' });
        doc.fillColor(statusColor).text(status,    MARGIN_L + 358, curY + 4, { width: CONTENT_W - 366 });
        doc.fillColor('#333');
        curY += 20;
      });
      curY += 10;
    }

    // ── Transactions ───────────────────────────────────────────────────────────
    if (transactions.length > 0) {
      // Always start transactions on a fresh area with at least 80px available,
      // otherwise start a new page.
      ensureSpace(80);
      sectionHeading(`TRANSACTIONS — ${monthName}`, 13);

      // Table header
      const drawTxnHeader = () => {
        ensureSpace(22);
        doc.rect(MARGIN_L, curY, CONTENT_W, 20).fill('#EDF0F5');
        doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
        doc.text('Date',        MARGIN_L + 8,   curY + 5, { width: 65 });
        doc.text('Description', MARGIN_L + 80,  curY + 5, { width: 145 });
        doc.text('Category',    MARGIN_L + 232, curY + 5, { width: 100 });
        doc.text('Amount',      MARGIN_L + 340, curY + 5, { width: CONTENT_W - 348, align: 'right' });
        curY += 22;
      };

      drawTxnHeader();

      transactions.forEach((tx, i) => {
        ensureSpace(22);
        // If a new page was just started, re-draw the column headers
        if (curY === 50) drawTxnHeader();

        if (i % 2 === 0) doc.rect(MARGIN_L, curY, CONTENT_W, 20).fill('#FAFBFC');

        const amtColor = tx.amount >= 0 ? '#00C896' : '#FF5C5C';
        const amtPrefix = tx.amount >= 0 ? '+' : '';
        const formattedDate = tx.date
          ? (tx.date instanceof Date ? tx.date.toISOString() : String(tx.date)).substring(0, 10)
          : '—';

        doc.fontSize(9).fillColor('#555').font('Helvetica');
        doc.text(formattedDate,       MARGIN_L + 8,   curY + 4, { width: 65 });
        doc.text(tx.name || '—',      MARGIN_L + 80,  curY + 4, { width: 145 });
        doc.text(tx.category || '—',  MARGIN_L + 232, curY + 4, { width: 100 });
        doc.fillColor(amtColor).font('Helvetica-Bold')
          .text(`${amtPrefix}${fmt(tx.amount)}`, MARGIN_L + 340, curY + 4, { width: CONTENT_W - 348, align: 'right' });
        doc.fillColor('#333');
        curY += 20;
      });
      curY += 10;
    }

    // ── Goals ──────────────────────────────────────────────────────────────────
    ensureSpace(60);
    sectionHeading('SAVINGS GOALS', 13);

    if (goals.length === 0) {
      ensureSpace(20);
      doc.fontSize(10).fillColor('#888').font('Helvetica').text('No savings goals set up yet.', MARGIN_L, curY);
      curY += 24;
    } else {
      goals.forEach(goal => {
        ensureSpace(50);
        const saved = parseFloat(goal.saved_amount);
        const target = parseFloat(goal.target_amount);
        const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

        // Bar background
        doc.rect(MARGIN_L, curY, CONTENT_W, 22).fill('#EDF0F5');
        // Bar fill
        const fillWidth = Math.max(0, CONTENT_W * pct / 100);
        if (fillWidth > 0) {
          const barColor = pct >= 100 ? '#00C896' : pct >= 50 ? '#4D9FFF' : '#FFAB2E';
          doc.rect(MARGIN_L, curY, fillWidth, 22).fill(barColor);
        }

        doc.fontSize(10).fillColor('#333').font('Helvetica-Bold').text(goal.name, MARGIN_L + 8, curY + 4, { width: 250 });
        doc.fontSize(10).fillColor('#333').font('Helvetica-Bold')
          .text(`${pct}%`, MARGIN_L, curY + 4, { width: CONTENT_W - 8, align: 'right' });
        curY += 26;

        doc.fontSize(9).fillColor('#555').font('Helvetica')
          .text(`${fmt(saved)} saved of ${fmt(target)} target`, MARGIN_L + 8, curY);
        curY += 20;
      });
    }
    curY += 10;

    // ── Net Worth Summary ──────────────────────────────────────────────────────
    ensureSpace(60);
    sectionHeading('NET WORTH SUMMARY', 13);

    doc.rect(MARGIN_L, curY, CONTENT_W, 1).fill('#E2E6EF');
    curY += 14;

    // Assets
    ensureSpace(22);
    doc.fontSize(11).fillColor('#00C896').font('Helvetica-Bold').text('ASSETS', MARGIN_L, curY);
    curY += 20;

    const assetItems = assets.filter(a => a.type === 'asset');
    if (assetItems.length === 0) {
      ensureSpace(18);
      doc.fontSize(9).fillColor('#888').font('Helvetica').text('No assets recorded.', MARGIN_L, curY);
      curY += 18;
    } else {
      assetItems.forEach(a => {
        ensureSpace(18);
        doc.fontSize(9).fillColor('#333').font('Helvetica').text(a.name, MARGIN_L, curY, { width: 250 });
        doc.text(fmt(a.value), MARGIN_L + 250, curY, { width: CONTENT_W - 250, align: 'right' });
        curY += 18;
      });
    }
    ensureSpace(22);
    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold').text('Total Assets:', MARGIN_L, curY, { width: 250 });
    doc.text(fmt(totalAssets), MARGIN_L + 250, curY, { width: CONTENT_W - 250, align: 'right' });
    curY += 24;

    // Liabilities
    ensureSpace(22);
    doc.fontSize(11).fillColor('#FF5C5C').font('Helvetica-Bold').text('LIABILITIES', MARGIN_L, curY);
    curY += 20;

    const liabItems = assets.filter(a => a.type === 'liability');
    if (liabItems.length === 0) {
      ensureSpace(18);
      doc.fontSize(9).fillColor('#888').font('Helvetica').text('No liabilities recorded.', MARGIN_L, curY);
      curY += 18;
    } else {
      liabItems.forEach(a => {
        ensureSpace(18);
        doc.fontSize(9).fillColor('#333').font('Helvetica').text(a.name, MARGIN_L, curY, { width: 250 });
        doc.text(fmt(Math.abs(a.value)), MARGIN_L + 250, curY, { width: CONTENT_W - 250, align: 'right' });
        curY += 18;
      });
    }
    ensureSpace(22);
    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold').text('Total Liabilities:', MARGIN_L, curY, { width: 250 });
    doc.text(fmt(totalLiabilities), MARGIN_L + 250, curY, { width: CONTENT_W - 250, align: 'right' });
    curY += 30;

    // Net worth bar
    ensureSpace(40);
    const netWorthColor = netWorth >= 0 ? '#00C896' : '#FF5C5C';
    doc.rect(MARGIN_L, curY, CONTENT_W, 34).fill('#0D0F14');
    doc.fontSize(13).fillColor('#fff').font('Helvetica-Bold').text('NET WORTH', MARGIN_L + 16, curY + 9, { width: 200 });
    doc.fillColor(netWorthColor).text(fmt(netWorth), MARGIN_L + 16, curY + 9, { width: CONTENT_W - 32, align: 'right' });
    curY += 34;

    // Footer on the final page
    addFooter();

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report.' });
    }
  }
});

module.exports = router;
