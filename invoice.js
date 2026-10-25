#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Batch mode: node invoice.js --json data.json
if (process.argv[2] === '--json') {
  const file = process.argv[3];
  if (!file) {
    console.error('Usage: node invoice.js --json data.json');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const now = new Date();
  const due = d.dueDate ? new Date(d.dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const items = d.items.map(it => ({ ...it, total: it.qty * it.rate }));
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const taxRate = d.taxRate || 0;
  const tax = subtotal * (taxRate / 100);
  const grandTotal = subtotal + tax;
  const html = buildInvoiceHTML({
    ...d, now, due, items, subtotal, taxRate, tax, grandTotal
  });
  const num = d.invoiceNum || ('INV-' + Date.now().toString().slice(-6));
  const filename = 'invoice-' + num.replace(/[^\w.-]/g, '_') + '.html';
  fs.writeFileSync(filename, html, 'utf8');
  console.log('INVOICE GENERATED: ' + filename + ' | Total: $' + grandTotal.toFixed(2));
  process.exit(0);
}

async function main() {
  console.log('\n=== PROFESSIONAL INVOICE GENERATOR ===\n');

  const company = await question('Your company/business name: ');
  const companyAddr = await question('Company address: ');
  const companyEmail = await question('Business email: ');

  console.log('\nClient info:');
  const clientName = await question('Client name: ');
  const clientAddr = await question('Client address: ');
  const clientEmail = await question('Client email: ');

  console.log('\nInvoice details:');
  let invoiceNum = await question('Invoice number (press Enter for auto): ');
  if (!invoiceNum) invoiceNum = 'INV-' + Date.now().toString().slice(-6);

  const dueDateStr = await question('Due date (YYYY-MM-DD, press Enter for +30 days): ');
  const now = new Date();
  const due = dueDateStr ? new Date(dueDateStr) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  console.log('\nLine items (type "done" when finished):');
  const items = [];
  let subtotal = 0;

  while (true) {
    const desc = await question('  Description: ');
    if (desc.trim().toLowerCase() === 'done') break;

    const qty = parseFloat(await question('  Quantity: '));
    const rate = parseFloat(await question('  Rate ($) per item: '));
    if (isNaN(qty) || isNaN(rate)) {
      console.log('    Invalid quantity/rate, item skipped.');
      continue;
    }

    const itemTotal = qty * rate;
    subtotal += itemTotal;
    items.push({ desc, qty, rate, total: itemTotal });
    console.log('    Item total: $' + itemTotal.toFixed(2));
  }

  const taxRateStr = await question('\nSales tax rate % (press Enter for 0): ');
  const taxRate = taxRateStr ? parseFloat(taxRateStr) || 0 : 0;
  const tax = subtotal * (taxRate / 100);
  const grandTotal = subtotal + tax;

  const html = buildInvoiceHTML({
    company, companyAddr, companyEmail,
    clientName, clientAddr, clientEmail,
    invoiceNum, now, due,
    items, subtotal, taxRate, tax, grandTotal
  });

  const filename = 'invoice-' + invoiceNum.replace(/[^\w.-]/g, '_') + '.html';
  fs.writeFileSync(filename, html, 'utf8');

  console.log('\n=======================================');
  console.log('  INVOICE GENERATED');
  console.log('  File:    ' + filename);
  console.log('  Total:   $' + grandTotal.toFixed(2));
  console.log('  Open in a browser -> Print -> Save as PDF');
  console.log('=======================================\n');

  rl.close();
}

function buildInvoiceHTML(d) {
  const money = n => '$' + n.toFixed(2);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Invoice ${esc(d.invoiceNum)}</title>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 40px; }
  .company h1 { margin: 0 0 8px; color: #2c3e50; }
  .company p, .invoice-info p { margin: 4px 0; color: #666; }
  .invoice-info { text-align: right; }
  .invoice-info h2 { margin: 0 0 8px; color: #e74c3c; }
  .client-info { margin-bottom: 30px; }
  .client-info h3 { margin: 0 0 8px; color: #2c3e50; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #ecf0f1; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #7f8c8d; border-bottom: 2px solid #ddd; }
  td { padding: 12px 15px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .totals { width: 250px; margin-left: auto; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; }
  .grand { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 15px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 12px; text-align: center; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>${esc(d.company)}</h1>
      <p>${esc(d.companyAddr)}</p>
      <p>${esc(d.companyEmail)}</p>
    </div>
    <div class="invoice-info">
      <h2>INVOICE</h2>
      <p><strong>${esc(d.invoiceNum)}</strong></p>
      <p>Date: ${d.now.toLocaleDateString()}</p>
      <p>Due: ${d.due.toISOString().split('T')[0]}</p>
    </div>
  </div>

  <div class="client-info">
    <h3>Bill To:</h3>
    <p>${esc(d.clientName)}</p>
    <p>${esc(d.clientAddr)}</p>
    <p>${esc(d.clientEmail)}</p>
  </div>

  <table>
    <tr><th>Description</th><th>Quantity</th><th>Rate</th><th class="r">Amount</th></tr>
`;

  d.items.forEach(it => {
    html += `    <tr><td>${esc(it.desc)}</td><td>${it.qty}</td><td>${money(it.rate)}</td><td class="r">${money(it.total)}</td></tr>\n`;
  });

  html += `  </table>

  <div class="totals">
    <div class="row"><span>Subtotal:</span><span>${money(d.subtotal)}</span></div>
    <div class="row"><span>Tax (${d.taxRate}%):</span><span>${money(d.tax)}</span></div>
    <div class="row grand"><span>Total Due:</span><span>${money(d.grandTotal)}</span></div>
  </div>

  <div class="footer"><p>Thank you for your business!</p></div>
</body>
</html>
`;

  return html;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
