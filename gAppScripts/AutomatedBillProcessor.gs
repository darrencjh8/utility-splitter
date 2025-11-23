/**
 * ============================================================================
 * CONFIGURATION & SETUP
 * ============================================================================
 */
const CONFIG = {
  SEARCH_QUERY: 'label:Bills-Pending', 
  PROCESSED_LABEL: 'Bills-Processed',
  
  SHEETS: {
    LOG: 'BillHistories',
    SPLITS: 'BillSplits',
    FIXED: 'FixedBills',
    MANUAL: 'ManualBills',
    OVERRIDE: 'BillOverride',
    PAID: 'PaidBills',
    STATUS: 'BillStatus'
  },
  
  // Column Indices (1-based)
  COLS: {
    MSG_ID: 8
  },
  
  PATTERNS: [
    { name: "SP Digital", amountRegex: /Amount\s*\$([\d,]+\.\d{2})/i, dateRegex: /Date\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i },
    { name: "Senoko Energy", amountRegex: /Total charge[\s\S]*?\$([\d,]+\.\d{2})/i, dateRegex: /Your\s+([A-Za-z]{3}\s+\d{4})'s/i },
    { name: "Generic Fallback", amountRegex: /(?:Total|Amount|Due|Balance).*?[\$A-Z]{0,3}\s*([\d,]+\.\d{2})/i, dateRegex: null }
  ]
};

/**
 * ============================================================================
 * MAIN ORCHESTRATOR
 * ============================================================================
 */
function processMonthlyBills() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    log: ss.getSheetByName(CONFIG.SHEETS.LOG),
    splits: ss.getSheetByName(CONFIG.SHEETS.SPLITS),
    fixed: ss.getSheetByName(CONFIG.SHEETS.FIXED),
    manual: ss.getSheetByName(CONFIG.SHEETS.MANUAL),
    override: ss.getSheetByName(CONFIG.SHEETS.OVERRIDE),
    paid: ss.getSheetByName(CONFIG.SHEETS.PAID),
    status: ss.getSheetByName(CONFIG.SHEETS.STATUS)
  };

  if (!validateSheets(sheets)) return;

  const splitData = sheets.splits.getDataRange().getValues();
  const expectedVendors = splitData[0].slice(2).filter(h => h !== ""); 

  // 1. Ingest & Update Tracker
  ingestNewData(sheets, expectedVendors);

  // 2. Process Pending Months
  processPendingMonths(sheets, expectedVendors);
}

/**
 * ============================================================================
 * PHASE 1: DATA INGESTION
 * ============================================================================
 */
function ingestNewData(sheets, expectedVendors) {
  const historyIndices = getHistoryIndices(sheets.log); 
  const billsToAdd = [];

  billsToAdd.push(...fetchEmailBills(historyIndices.msgIds));
  billsToAdd.push(...fetchManualBills(sheets.manual, historyIndices.vendorMonths));
  billsToAdd.push(...fetchOverrideBills(sheets.override, historyIndices.vendorMonths));

  if (billsToAdd.length === 0) {
    console.log("No new bills found.");
    return;
  }

  // Batch Write to History
  logTransactions(sheets.log, billsToAdd);
  
  // Batch Label Update
  const threadsToLabel = billsToAdd.map(b => b.thread).filter(t => t);
  if (threadsToLabel.length > 0) batchUpdateLabels(threadsToLabel);

  // Update Status Tracker (Strict Deduplication)
  updateStatusTracker(sheets.status, billsToAdd, expectedVendors);
  
  console.log(`Ingested ${billsToAdd.length} new bills.`);
}

function updateStatusTracker(statusSheet, newBills, expectedVendors) {
  const data = statusSheet.getDataRange().getValues();
  const monthRowMap = new Map();
  
  // Map existing rows: Normalized Month -> Row Index (1-based)
  for (let i = 1; i < data.length; i++) {
    const rawMonth = data[i][0];
    if (rawMonth) {
      // FIX: Force normalization of existing sheet data to String key
      const normMonth = formatMonth(rawMonth);
      if (!monthRowMap.has(normMonth)) {
        monthRowMap.set(normMonth, i + 1);
      }
    }
  }

  // Group new bills by normalized month
  const billsByMonth = {};
  newBills.forEach(b => {
    const m = formatMonth(b.month);
    if (!billsByMonth[m]) billsByMonth[m] = [];
    billsByMonth[m].push(b.vendor);
  });

  // Update rows
  Object.keys(billsByMonth).forEach(month => {
    const newVendors = billsByMonth[month];
    let rowIndex = monthRowMap.get(month);
    
    let received = [];
    let missing = [...expectedVendors];
    let status = "Pending";

    if (rowIndex) {
      // Update Existing Row
      const rowVals = statusSheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
      received = parseJson(rowVals[2]) || [];
      received = [...new Set([...received, ...newVendors])];
      missing = expectedVendors.filter(v => !received.includes(v));
      
      statusSheet.getRange(rowIndex, 3, 1, 2).setValues([[JSON.stringify(received), JSON.stringify(missing)]]);
    } else {
      // Create New Row
      received = [...new Set(newVendors)];
      missing = expectedVendors.filter(v => !received.includes(v));
      
      statusSheet.appendRow([month, status, JSON.stringify(received), JSON.stringify(missing)]);
      
      // Update map immediately
      monthRowMap.set(month, statusSheet.getLastRow()); 
    }
  });
}

/**
 * ============================================================================
 * PHASE 2: PROCESSING
 * ============================================================================
 */
function processPendingMonths(sheets, expectedVendors) {
  const statusData = sheets.status.getDataRange().getValues();
  const housemates = getHousemateConfigs(sheets.splits.getDataRange().getValues());
  const fixedBillDefs = getFixedBillDefinitions(sheets.fixed);

  ensureCurrentMonthTracker(sheets.status, statusData, expectedVendors);

  const processedMonths = new Set(); 

  // Skip Header (i=1)
  for (let i = 1; i < statusData.length; i++) {
    const rawMonth = statusData[i][0];
    const status = statusData[i][1];
    const receivedJson = statusData[i][2];
    const missingJson = statusData[i][3];
    
    // FIX: Normalize month immediately. 
    // This prevents "Sat Nov 01..." IDs and ensures set deduplication works.
    const month = formatMonth(rawMonth);

    if (!month || processedMonths.has(month)) continue;
    processedMonths.add(month);

    if (status === 'Sent') continue;

    let missing = parseJson(missingJson) || expectedVendors;
    let received = parseJson(receivedJson) || [];

    // 1. Backfill Check
    const backfills = getBackfillBills(missing, fixedBillDefs, month); // 'month' is now strictly a string
    if (backfills.length > 0) {
      console.log(`Backfilling ${backfills.length} bills for ${month}`);
      
      logTransactions(sheets.log, backfills.map(b => b.logEntry));
      
      backfills.forEach(b => {
        received.push(b.vendor);
        missing = missing.filter(v => v !== b.vendor);
      });

      // Update Tracker immediately
      sheets.status.getRange(i + 1, 3, 1, 2).setValues([[JSON.stringify(received), JSON.stringify(missing)]]);
    }

    // 2. Final Completeness Check
    if (missing.length === 0) {
      console.log(`Completing Month: ${month}`);
      
      const rawBills = getBillsForMonth(sheets.log, month);
      const cleanBills = deduplicateBills(rawBills);
      const paidRows = calculateAndNotify(month, cleanBills, housemates);
      
      if (paidRows.length > 0) {
        batchAppendRows(sheets.paid, paidRows);
      }
      
      sheets.status.getRange(i + 1, 2).setValue("Sent");
      sheets.log.appendRow([new Date(), month, "SYSTEM", "Consolidation Sent", 0, "", "Completed", `SENT-${month}`]);
      
    } else {
      console.log(`Pending ${month}: Waiting for ${missing.join(", ")}`);
    }
  }
}

function deduplicateBills(bills) {
  const overrides = new Set();
  bills.forEach(b => {
    if (b.id && b.id.toString().includes('OVERRIDE')) overrides.add(b.vendor);
  });
  return bills.filter(b => {
    if (overrides.has(b.vendor)) return b.id && b.id.toString().includes('OVERRIDE');
    return true; 
  });
}

function ensureCurrentMonthTracker(sheet, data, expectedVendors) {
  const currentMonth = formatMonth(new Date());
  // FIX: Normalize data rows before comparing
  const exists = data.some(row => formatMonth(row[0]) === currentMonth);
  if (!exists) {
    sheet.appendRow([currentMonth, "Pending", "[]", JSON.stringify(expectedVendors)]);
    data.push([currentMonth, "Pending", "[]", JSON.stringify(expectedVendors)]);
  }
}

/**
 * ============================================================================
 * FETCHERS & UTILS
 * ============================================================================
 */
function getBillsForMonth(logSheet, targetMonth) {
  const data = logSheet.getDataRange().getValues();
  const bills = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const month = row[1]; // Col B
    const vendor = row[2]; // Col C
    
    // FIX: Strict String Comparison
    if (formatMonth(month) === targetMonth && vendor !== 'SYSTEM') {
      bills.push({
        vendor: vendor,
        total: parseFloat(row[4]),
        manualAllocations: parseJson(row[5]),
        id: row[7] 
      });
    }
  }
  return bills;
}

function calculateAndNotify(month, bills, housemates) {
  const userAggregates = {}; 
  const timestamp = new Date();
  const paidRows = [];

  bills.forEach(bill => {
    housemates.forEach(hm => {
      let share = 0;
      if (bill.manualAllocations && bill.manualAllocations[hm.name] !== undefined) {
        share = bill.manualAllocations[hm.name];
      } else {
        const ratio = hm.ratios[bill.vendor] || 0;
        if (ratio > 0) share = bill.total * ratio;
      }
      
      if (share > 0) {
        if (!userAggregates[hm.name]) userAggregates[hm.name] = { email: hm.email, name: hm.name, items: [], totalOwed: 0 };
        userAggregates[hm.name].items.push({ vendor: bill.vendor, share: share });
        userAggregates[hm.name].totalOwed += share;
      }
    });
  });

  Object.values(userAggregates).forEach(user => {
    if (user.totalOwed > 0) {
      sendFinalEmail(user.email, user.name, month, user.items, user.totalOwed);
      const breakdown = user.items.map(i => `${i.vendor}: $${i.share.toFixed(2)}`).join(", ");
      paidRows.push([timestamp, month, user.name, user.email, user.totalOwed, breakdown]);
    }
  });

  return paidRows;
}

function sendFinalEmail(email, name, month, items, totalOwed) {
  const isRent = (i) => i.vendor.toLowerCase().includes('rent');
  const rentItems = items.filter(isRent);
  const otherItems = items.filter(i => !isRent(i));

  const rentTotal = rentItems.reduce((sum, i) => sum + i.share, 0);
  const otherTotal = otherItems.reduce((sum, i) => sum + i.share, 0);

  const generateRows = (list) => list.map(i => 
    `<tr><td style="padding:8px;border:1px solid #ddd">${i.vendor}</td><td style="padding:8px;border:1px solid #ddd">$${i.share.toFixed(2)}</td></tr>`
  ).join("");

  let tableRows = "";
  if (rentItems.length > 0) {
    tableRows += `<tr><td colspan="2" style="background:#e8f5e9;padding:8px;border:1px solid #ddd"><strong>Rent</strong></td></tr>` + 
                 generateRows(rentItems) + 
                 `<tr><td style="text-align:right;padding:8px;color:#555"><em>Rent Subtotal:</em></td><td style="padding:8px;color:#555"><em>$${rentTotal.toFixed(2)}</em></td></tr>`;
  }
  if (otherItems.length > 0) {
    tableRows += `<tr><td colspan="2" style="background:#e3f2fd;padding:8px;border:1px solid #ddd"><strong>Utilities & Others</strong></td></tr>` + 
                 generateRows(otherItems) + 
                 `<tr><td style="text-align:right;padding:8px;color:#555"><em>Utilities Subtotal:</em></td><td style="padding:8px;color:#555"><em>$${otherTotal.toFixed(2)}</em></td></tr>`;
  }

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#333">
      <h3>Hi ${name},</h3>
      <p>All bills for <strong>${month}</strong> are processed.</p>
      <table style="border-collapse:collapse;width:100%;max-width:600px">
        <thead><tr style="background:#f2f2f2"><th style="padding:8px;border:1px solid #ddd;text-align:left">Vendor</th><th style="padding:8px;border:1px solid #ddd;text-align:left">Your Share</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr style="background:#333;color:#fff"><td style="padding:10px;text-align:right"><strong>GRAND TOTAL:</strong></td><td style="padding:10px"><strong>$${totalOwed.toFixed(2)}</strong></td></tr></tfoot>
      </table>
    </div>`;

  GmailApp.sendEmail(email, `Monthly Bill Summary - ${month}`, "Please enable HTML email.", { htmlBody: htmlBody });
}

function fetchEmailBills(processedIds) {
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY);
  const results = [];
  threads.forEach(thread => {
    const msg = thread.getMessages().pop();
    const id = msg.getId();
    if (processedIds.has(id)) { results.push({ thread: thread, amount: 0 }); return; }
    const details = extractBillDetails(msg.getPlainBody(), msg.getDate());
    if (details.amount > 0) {
      results.push({
        vendor: details.vendorName,
        month: details.billMonth,
        total: details.amount,
        subject: msg.getSubject(),
        id: id,
        thread: thread,
        manualData: null,
        amount: details.amount
      });
    }
  });
  return results.filter(r => r.amount > 0);
}

function fetchManualBills(sheet, processedVendorMonths) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0]; 
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const rawMonth = data[i][0];
    const vendor = data[i][1];
    if (!rawMonth || !vendor) continue;
    const monthStr = formatMonth(rawMonth);
    const uniqueKey = `${vendor}-${monthStr}-MANUAL`;
    if (processedVendorMonths.has(uniqueKey)) continue;

    const allocations = {};
    let rowTotal = 0;
    for (let c = 2; c < headers.length; c++) {
      if (data[i][c] > 0) { allocations[headers[c]] = data[i][c]; rowTotal += data[i][c]; }
    }
    results.push(createBillObject(vendor, monthStr, rowTotal, `Manual Entry`, `MANUAL-${uniqueKey}`, allocations));
  }
  return results;
}

function fetchOverrideBills(sheet, processedVendorMonths) {
  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const [rawMonth, vendor, amount] = data[i];
    if (!rawMonth || !vendor || !amount) continue;
    const monthStr = formatMonth(rawMonth);
    const uniqueKey = `${vendor}-${monthStr}`;
    if (processedVendorMonths.has(uniqueKey)) continue;
    results.push(createBillObject(vendor, monthStr, parseFloat(amount), `Bill Override`, `OVERRIDE-${uniqueKey}`, null));
  }
  return results;
}

function getBackfillBills(missingVendors, fixedDefs, month) {
  const backfills = [];
  missingVendors.forEach(vendor => {
    if (fixedDefs[vendor] !== undefined) {
      const amount = fixedDefs[vendor];
      backfills.push({
        vendor: vendor,
        logEntry: createBillObject(vendor, month, amount, 'Fixed Bill - Backfilled', `FIXED-${vendor}-${month}`, null),
        inMemory: { vendor: vendor, total: amount, manualAllocations: null }
      });
    }
  });
  return backfills;
}

function createBillObject(vendor, month, total, type, id, manualData) {
  // ensure month is string to prevent Date object in ID
  return { vendor, month, total, subject: `${vendor} (${type})`, id, manualData, thread: null };
}

function logTransactions(sheet, bills) {
  const rows = bills.map(b => [new Date(), b.month, b.vendor, b.subject, b.total, b.manualData ? JSON.stringify(b.manualData) : "", "Ingested", b.id]);
  batchAppendRows(sheet, rows);
}

function batchAppendRows(sheet, rows) {
  if (rows.length === 0) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function batchUpdateLabels(threads) {
  const p = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  const s = getOrCreateLabel(CONFIG.SEARCH_QUERY.replace('label:', ''));
  for (let i = 0; i < threads.length; i += 100) {
    const chunk = threads.slice(i, i + 100);
    p.addToThreads(chunk);
    s.removeFromThreads(chunk);
  }
}

function getHistoryIndices(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { msgIds: new Set(), vendorMonths: new Set() };
  const data = sheet.getRange(2, 1, lastRow - 1, CONFIG.COLS.MSG_ID).getValues();
  const msgIds = new Set(), vendorMonths = new Set();
  data.forEach(row => {
    const [_, month, vendor, __, ___, ____, _____, id] = row;
    if (id) msgIds.add(id.toString());
    
    // FIX: Normalize Month for Key Generation
    const mStr = formatMonth(month);
    
    if (mStr && vendor) vendorMonths.add(`${vendor}-${mStr}`);
    const idStr = id ? id.toString() : '';
    if (idStr.match(/^(FIXED|MANUAL|OVERRIDE)-/)) vendorMonths.add(idStr.replace(/^(FIXED|MANUAL|OVERRIDE)-/, ''));
  });
  return { msgIds, vendorMonths };
}

function extractBillDetails(text, emailDate) {
  let foundAmount = 0, foundDate = null, matchedVendor = "Generic Fallback";
  for (const p of CONFIG.PATTERNS) {
    const amtMatch = text.match(p.amountRegex);
    if (amtMatch && amtMatch[1]) {
      foundAmount = parseFloat(amtMatch[1].replace(',', ''));
      matchedVendor = p.name;
      if (p.dateRegex) {
        const d = text.match(p.dateRegex);
        if (d && d[1]) { const pd = new Date(d[1]); if (!isNaN(pd)) foundDate = pd; }
      }
      break; 
    }
  }
  return { amount: foundAmount, billMonth: formatMonth(foundDate || emailDate), vendorName: matchedVendor };
}

function getHousemateConfigs(data) {
  const headers = data[0];
  const configs = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ratios = {};
    for (let c = 2; c < headers.length; c++) ratios[headers[c]] = row[c];
    configs.push({ name: row[0], email: row[1], ratios });
  }
  return configs;
}

function getFixedBillDefinitions(sheet) {
  const data = sheet.getDataRange().getValues();
  const defs = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) defs[data[i][0]] = parseFloat(data[i][1]);
  }
  return defs;
}

/**
 * CORE FIX: Safe Date Normalizer
 * Converts Dates to Strings. Returns Strings as is.
 */
function formatMonth(dateInput) {
  if (!dateInput) return "";
  
  // If it's already a string like "November 2025", return it
  if (typeof dateInput === 'string' && dateInput.includes(' ')) return dateInput;

  // Otherwise treat as date object
  const d = (typeof dateInput === 'object') ? dateInput : new Date(dateInput);
  
  // Guard against invalid dates
  if (isNaN(d.getTime())) return String(dateInput); 
  
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM yyyy");
}

function parseJson(str) {
  try { return (str && str.toString().trim().startsWith("{") || str.toString().trim().startsWith("[")) ? JSON.parse(str) : null; } 
  catch (e) { return null; }
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function validateSheets(sheets) {
  for (const [key, sheet] of Object.entries(sheets)) {
    if (!sheet) { console.error(`Missing Sheet: ${key}`); return false; }
  }
  return true;
}