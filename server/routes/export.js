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

    // Net worth
    const totalAssets = assets
      .filter(a => a.type === 'asset')
      .reduce((sum, a) => sum + parseFloat(a.value), 0);
    const totalLiabilities = assets
      .filter(a => a.type === 'liability')
      .reduce((sum, a) => sum + parseFloat(a.value), 0);
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

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title: `FinanceIQ Monthly Report - ${monthName}`,
        Author: 'FinanceIQ',
        Subject: 'Personal Finance Report',
      },
    });

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FinanceIQ-Report-${month}.pdf"`);
    doc.pipe(res);

    // Helper: format currency
    const fmt = (val) => {
      const abs = Math.abs(val);
      const sign = val < 0 ? '-' : '';
      const parts = abs.toFixed(2).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${sign}R${parts[0]}.${parts[1]}`;
    };

    // Page tracking for footer
    let pageCount = 1;
    doc.on('pageAdded', () => {
      pageCount++;
    });

    // Helper: draw footer on each page
    const addFooter = () => {
      doc.fontSize(8).fillColor('#999');
      doc.text(`Page ${pageCount}`, 60, doc.page.height - 40, { align: 'center', width: doc.page.width - 120 });
    };

    // Track pages rendered
    let currentPage = 1;

    // ────────────────────────────────────
    // PAGE 1 — Cover & Summary
    // ────────────────────────────────────

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill('#0D0F14');
    doc.fontSize(28).fillColor('#00C896').font('Helvetica-Bold').text('FinanceIQ', 60, 22);
    doc.fontSize(10).fillColor('#888').font('Helvetica').text('Personal Finance Intelligence', 60, 56);

    doc.moveDown(6);

    // Title
    doc.fontSize(22).fillColor('#333').font('Helvetica-Bold').text('Monthly Financial Report', 60, 110);
    doc.fontSize(14).fillColor('#666').font('Helvetica').text(monthName, 60, 140);
    doc.fontSize(9).fillColor('#999').font('Helvetica').text(`Generated on ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}`, 60, 162);

    // Summary section
    doc.moveDown(4);
    const summaryY = 210;
    doc.rect(60, summaryY, doc.page.width - 120, 160).fill('#F5F7FA');

    doc.fontSize(11).fillColor('#333').font('Helvetica-Bold').text('SUMMARY', 80, summaryY + 15);

    const summaryItems = [
      { label: 'Total Income', value: fmt(totalIncome), color: '#00C896' },
      { label: 'Total Expenses', value: fmt(totalExpenses), color: '#FF5C5C' },
      { label: 'Net Savings', value: fmt(netSavings), color: netSavings >= 0 ? '#00C896' : '#FF5C5C' },
      { label: 'Savings Rate', value: `${savingsRate}%`, color: '#4D9FFF' },
      { label: 'Net Worth', value: fmt(netWorth), color: netWorth >= 0 ? '#00C896' : '#FF5C5C' },
    ];

    summaryItems.forEach((item, i) => {
      const y = summaryY + 38 + i * 22;
      doc.fontSize(10).fillColor('#555').font('Helvetica').text(item.label, 80, y);
      doc.fontSize(10).fillColor(item.color).font('Helvetica-Bold').text(item.value, 400, y, { align: 'right', width: 150 });
    });

    // Spending by category table
    const catTableY = summaryY + 185;
    const categories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);

    doc.fontSize(11).fillColor('#333').font('Helvetica-Bold').text('SPENDING BY CATEGORY', 60, catTableY);

    // Table header
    const thY = catTableY + 22;
    const colX = [60, 210, 320, 390];
    const colWidths = [140, 100, 70, 90];
    doc.rect(60, thY, doc.page.width - 120, 20).fill('#EDF0F5');
    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
    doc.text('Category', colX[0] + 8, thY + 5, { width: colWidths[0] });
    doc.text('Spent', colX[1] + 8, thY + 5, { width: colWidths[1], align: 'right' });
    doc.text('Budget', colX[2] + 8, thY + 5, { width: colWidths[2], align: 'right' });
    doc.text('Status', colX[3] + 8, thY + 5, { width: colWidths[3] });

    categories.forEach(([cat, spent], i) => {
      const y = thY + 22 + i * 20;
      if (i % 2 === 0) doc.rect(60, y, doc.page.width - 120, 20).fill('#FAFBFC');

      const budget = budgets.find(b => b.category === cat);
      const budgetAmount = budget ? parseFloat(budget.monthly_limit) : 0;
      const pctUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : null;
      let status = budgetAmount === 0 ? 'No budget set' : '';
      let statusColor = '#888';
      if (pctUsed !== null) {
        if (pctUsed > 100) { status = `⚠ Over (${pctUsed}%)`; statusColor = '#FF5C5C'; }
        else if (pctUsed === 100) { status = `⚠ At limit`; statusColor = '#FFAB2E'; }
        else { status = `✓ ${pctUsed}% used`; statusColor = '#00C896'; }
      }

      doc.fontSize(9).fillColor('#333').font('Helvetica');
      doc.text(cat, colX[0] + 8, y + 4, { width: colWidths[0] });
      doc.text(fmt(spent), colX[1] + 8, y + 4, { width: colWidths[1], align: 'right' });
      doc.text(budgetAmount > 0 ? fmt(budgetAmount) : '—', colX[2] + 8, y + 4, { width: colWidths[2], align: 'right' });
      doc.fillColor(statusColor).text(status, colX[3] + 8, y + 4, { width: colWidths[3] });
      doc.fillColor('#333');
    });

    // Check if we need a new page for transactions
    const transactionsStartY = catTableY + 55 + categories.length * 22 + 30;
    if (transactionsStartY > doc.page.height - 100) {
      doc.addPage();
      addFooter();
    }

    // ────────────────────────────────────
    // PAGE 2 — Transactions
    // ────────────────────────────────────

    // Section header
    const txnY = doc.y > 80 ? doc.y + 20 : 100;
    doc.fontSize(14).fillColor('#333').font('Helvetica-Bold').text(`TRANSACTIONS — ${monthName}`, 60, txnY);

    // Table header
    const tthY = txnY + 25;
    const tColX = [60, 130, 270, 390];
    doc.rect(60, tthY, doc.page.width - 120, 20).fill('#EDF0F5');
    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
    doc.text('Date', tColX[0] + 8, tthY + 5, { width: 60 });
    doc.text('Description', tColX[1] + 8, tthY + 5, { width: 130 });
    doc.text('Category', tColX[2] + 8, tthY + 5, { width: 90 });
    doc.text('Amount', tColX[3] + 8, tthY + 5, { width: 80, align: 'right' });

    let pageBreakOffset = 0;
    transactions.forEach((tx, i) => {
      const y = tthY + 22 + i * 20 - pageBreakOffset;

      // Check for page overflow
      if (y > doc.page.height - 60) {
        doc.addPage();
        addFooter();
        // Re-draw header on new page
        const newY = 50;
        doc.rect(60, newY, doc.page.width - 120, 20).fill('#EDF0F5');
        doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
        doc.text('Date', tColX[0] + 8, newY + 5, { width: 60 });
        doc.text('Description', tColX[1] + 8, newY + 5, { width: 130 });
        doc.text('Category', tColX[2] + 8, newY + 5, { width: 90 });
        doc.text('Amount', tColX[3] + 8, newY + 5, { width: 80, align: 'right' });
        // Recalculate offset so next rows start from top of new page
        pageBreakOffset = i * 20 - (newY + 22 - tthY - 22);
      }

      const rowY = tthY + 22 + i * 20 - pageBreakOffset;
      if (i % 2 === 0) doc.rect(60, rowY, doc.page.width - 120, 20).fill('#FAFBFC');

      const txnDate = new Date(tx.date).toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const amtColor = tx.amount >= 0 ? '#00C896' : '#FF5C5C';
      const amtPrefix = tx.amount >= 0 ? '+' : '';
      const formattedDate = tx.date ? tx.date.substring(0, 10) : '—';

      doc.fontSize(9).fillColor('#555').font('Helvetica');
      doc.text(formattedDate, tColX[0] + 8, rowY + 4, { width: 60 });
      doc.text(tx.name, tColX[1] + 8, rowY + 4, { width: 130 });
      doc.text(tx.category || '—', tColX[2] + 8, rowY + 4, { width: 90 });
      doc.fillColor(amtColor).font('Helvetica-Bold');
      doc.text(`${amtPrefix}${fmt(tx.amount)}`, tColX[3] + 8, rowY + 4, { width: 80, align: 'right' });
      doc.fillColor('#333');
      adjustedY = undefined;
    });

    // ────────────────────────────────────
    // PAGE 3 — Goals & Net Worth
    // ────────────────────────────────────

    doc.addPage();
    addFooter();

    // Goals section
    let goalsY = 50;
    doc.fontSize(14).fillColor('#333').font('Helvetica-Bold').text('SAVINGS GOALS', 60, goalsY);

    if (goals.length === 0) {
      doc.fontSize(10).fillColor('#888').font('Helvetica').text('No savings goals set up yet.', 60, goalsY + 30);
    } else {
      goals.forEach((goal, i) => {
        const y = goalsY + 35 + i * 55;
        const saved = parseFloat(goal.saved_amount);
        const target = parseFloat(goal.target_amount);
        const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
        const remaining = target - saved;

        // Bar background
        doc.rect(60, y, doc.page.width - 120, 24).fill('#EDF0F5');
        // Bar fill
        const fillWidth = ((doc.page.width - 120) * pct) / 100;
        if (fillWidth > 0) {
          const barColor = pct >= 100 ? '#00C896' : pct >= 50 ? '#4D9FFF' : '#FFAB2E';
          doc.rect(60, y, fillWidth, 24).fill(barColor);
        }

        doc.fontSize(10).fillColor('#333').font('Helvetica-Bold');
        doc.text(goal.name, 68, y + 5, { width: 250 });
        doc.fontSize(9).fillColor('#555').font('Helvetica');
        doc.text(`${fmt(saved)} / ${fmt(target)}`, 68, y + 26, { width: 200 });
        doc.fontSize(10).fillColor('#333').font('Helvetica-Bold');
        doc.text(`${pct}%`, doc.page.width - 100, y + 5, { width: 40, align: 'right' });
      });
    }

    // Net Worth section
    const nwY = Math.max(goalsY + 35 + (goals.length > 0 ? goals.length * 55 + 30 : 60), doc.y + 40);
    doc.fontSize(14).fillColor('#333').font('Helvetica-Bold').text('NET WORTH SUMMARY', 60, nwY);

    const dividerY = nwY + 25;
    doc.rect(60, dividerY, doc.page.width - 120, 1).fill('#E2E6EF');

    // Assets
    const assetTitleY = dividerY + 15;
    doc.fontSize(11).fillColor('#00C896').font('Helvetica-Bold').text('ASSETS', 60, assetTitleY);

    const assetItems = assets.filter(a => a.type === 'asset');
    let assetTotalY = assetTitleY + 22;
    if (assetItems.length === 0) {
      doc.fontSize(9).fillColor('#888').font('Helvetica').text('No assets recorded.', 60, assetTotalY);
      assetTotalY += 18;
    } else {
      assetItems.forEach((a, i) => {
        const y = assetTitleY + 22 + i * 18;
        doc.fontSize(9).fillColor('#333').font('Helvetica');
        doc.text(a.name, 60, y, { width: 200 });
        doc.text(fmt(a.value), 400, y, { width: 100, align: 'right' });
        assetTotalY = y + 18;
      });
    }

    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
    doc.text('Total Assets:', 60, assetTotalY + 5, { width: 200 });
    doc.text(fmt(totalAssets), 400, assetTotalY + 5, { width: 100, align: 'right' });

    // Liabilities
    const liabTitleY = assetTotalY + 35;
    doc.fontSize(11).fillColor('#FF5C5C').font('Helvetica-Bold').text('LIABILITIES', 60, liabTitleY);

    const liabItems = assets.filter(a => a.type === 'liability');
    let liabTotalY = liabTitleY + 22;
    if (liabItems.length === 0) {
      doc.fontSize(9).fillColor('#888').font('Helvetica').text('No liabilities recorded.', 60, liabTotalY);
      liabTotalY += 18;
    } else {
      liabItems.forEach((a, i) => {
        const y = liabTitleY + 22 + i * 18;
        doc.fontSize(9).fillColor('#333').font('Helvetica');
        doc.text(a.name, 60, y, { width: 200 });
        doc.text(fmt(a.value), 400, y, { width: 100, align: 'right' });
        liabTotalY = y + 18;
      });
    }

    doc.fontSize(9).fillColor('#333').font('Helvetica-Bold');
    doc.text('Total Liabilities:', 60, liabTotalY + 5, { width: 200 });
    doc.text(fmt(totalLiabilities), 400, liabTotalY + 5, { width: 100, align: 'right' });

    // Net Worth final line
    const finalY = liabTotalY + 40;
    const netWorthColor = netWorth >= 0 ? '#00C896' : '#FF5C5C';
    doc.rect(60, finalY - 8, doc.page.width - 120, 35).fill('#0D0F14');
    doc.fontSize(14).fillColor('#fff').font('Helvetica-Bold');
    doc.text('NET WORTH', 80, finalY + 2, { width: 200 });
    doc.fillColor(netWorthColor).text(fmt(netWorth), 350, finalY + 2, { width: 160, align: 'right' });

    // Footer on last page
    addFooter();

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;