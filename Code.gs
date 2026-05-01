// ═══════════════════════════════════════════════════════════════
//  HR PORTAL — Google Apps Script Backend
//  Paste this entire file into your Apps Script project (Code.gs)
//  Then: Deploy → New deployment → Web App
//        Execute as: Me  |  Who can access: Anyone
// ═══════════════════════════════════════════════════════════════

// ── CONFIGURATION ────────────────────────────────────────────
const MASTER_SHEET_NAME  = 'Master';       // Tab name in your spreadsheet
const ADMIN_SHEET_NAME   = 'AdminLog';     // Optional log tab for admin
const ADMIN_SECRET       = 'ADMIN_SECRET_KEY_CHANGE_THIS'; // Change this!

// Column order in Master sheet (1-indexed, matches header row)
const COLS = {
  SNO:               1,
  LOCATION:          2,
  REGION:            3,
  BRANCH:            4,
  NAME:              5,
  DEPARTMENT:        6,
  POST:              7,
  MSPIN:             8,
  MOBILE:            9,
  EMAIL:             10,
  ACADEMIC:          11,
  PROFESSIONAL:      12,
  CERT_STATUS:       13,
  CERT_DETAILS:      14,
  GENDER:            15,
  MARITAL_STATUS:    16,
  ANNIVERSARY:       17,
  FATHERS_NAME:      18,
  DOB:               19,
  PRESENT_ADDRESS:   20,
  PERMANENT_ADDRESS: 21,
  DOJ:               22,
  MONTHS_CACL:       23,
  AS_PER_ROLLS:      24,
  AS_DMS:            25,
  MONTHS_DMS:        26,
  BASIC:             27,
  HRA:               28,
  CONVY:             29,
  GROSS_SALARY:      30,
  ROLL_TYPE:         31,
  JOIN_STATUS:       32,
  TIMESTAMP:         33,
  TOTAL_COLS:        33
};

// ── HEADER ROW ───────────────────────────────────────────────
const HEADERS = [
  'S.No', 'Location', 'Region', 'Branch', 'Name', 'Department', 'Post', 'MSPIN No.',
  'Personal Mobile No.', 'Personal Email ID', 'Academic Qualification', 'Professional Qualification',
  'Certification Status', 'Certification Details', 'Gender', 'Marital Status',
  'Date of Anniversary', "Father's Name", 'Date of Birth', 'Present Address',
  'Permanent Address', 'Date of Joining', 'Nos. of Months in CACL', 'As Per Rolls',
  'As DMS', 'Nos. of Months in DMS', 'Basic', 'HRA', 'Conveyance', 'Gross Salary',
  'On Rolls/Off Rolls/Arena/Nexa', 'Join Status', 'Timestamp'
];


// ── ENTRY POINT ──────────────────────────────────────────────
function doGet(e) {
  try {
    const payload = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
    const { action } = payload;

    let result;
    if      (action === 'add')         result = addEmployee(payload);
    else if (action === 'get')         result = getRecords(payload);
    else if (action === 'edit')        result = editEmployee(payload);
    else if (action === 'admin_get')   result = adminGetAll(payload);
    else if (action === 'admin_del')   result = adminDelete(payload);
    else if (action === 'admin_force') result = adminForceStatus(payload);
    else                               result = { success: false, error: 'Unknown action' };

    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── SHEET HELPERS ────────────────────────────────────────────
function getMasterSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MASTER_SHEET_NAME);
    const headerRow = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRow.setValues([HEADERS]);
    headerRow.setFontWeight('bold');
    headerRow.setBackground('#3f51b5');
    headerRow.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 150);
  }
  return sheet;
}

function getNextSno(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const vals = sheet.getRange(2, COLS.SNO, lastRow - 1, 1).getValues();
  let max = 0;
  vals.forEach(r => { if (Number(r[0]) > max) max = Number(r[0]); });
  return max + 1;
}

function rowToObject(row, rowIndex) {
  return {
    rowIndex:          rowIndex,
    sno:               row[COLS.SNO - 1],
    location:          row[COLS.LOCATION - 1],
    region:            row[COLS.REGION - 1],
    branch:            row[COLS.BRANCH - 1],
    name:              row[COLS.NAME - 1],
    department:        row[COLS.DEPARTMENT - 1],
    post:              row[COLS.POST - 1],
    mspin:             row[COLS.MSPIN - 1],
    mobile:            row[COLS.MOBILE - 1],
    email:             row[COLS.EMAIL - 1],
    academic:          row[COLS.ACADEMIC - 1],
    professional:      row[COLS.PROFESSIONAL - 1],
    cert_status:       row[COLS.CERT_STATUS - 1],
    cert_details:      row[COLS.CERT_DETAILS - 1],
    gender:            row[COLS.GENDER - 1],
    marital_status:    row[COLS.MARITAL_STATUS - 1],
    anniversary:       formatDate(row[COLS.ANNIVERSARY - 1]),
    fathers_name:      row[COLS.FATHERS_NAME - 1],
    dob:               formatDate(row[COLS.DOB - 1]),
    present_address:   row[COLS.PRESENT_ADDRESS - 1],
    permanent_address: row[COLS.PERMANENT_ADDRESS - 1],
    doj:               formatDate(row[COLS.DOJ - 1]),
    months_cacl:       row[COLS.MONTHS_CACL - 1],
    as_per_rolls:      formatDate(row[COLS.AS_PER_ROLLS - 1]),
    as_dms:            formatDate(row[COLS.AS_DMS - 1]),
    months_dms:        row[COLS.MONTHS_DMS - 1],
    basic:             row[COLS.BASIC - 1],
    hra:               row[COLS.HRA - 1],
    convy:             row[COLS.CONVY - 1],
    gross_salary:      row[COLS.GROSS_SALARY - 1],
    roll_type:         row[COLS.ROLL_TYPE - 1],
    join_status:       row[COLS.JOIN_STATUS - 1],
    timestamp:         row[COLS.TIMESTAMP - 1]
  };
}

function formatDate(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch(e) { return String(val); }
}


// ── ACTION: ADD EMPLOYEE ─────────────────────────────────────
function addEmployee(p) {
  if (!p.location) return { success: false, error: 'Location missing' };
  if (!p.name)     return { success: false, error: 'Employee name is required' };

  const sheet = getMasterSheet();
  const sno   = getNextSno(sheet);
  const ts    = new Date();

  const newRow = new Array(COLS.TOTAL_COLS).fill('');
  newRow[COLS.SNO - 1]               = sno;
  newRow[COLS.LOCATION - 1]          = p.location;
  newRow[COLS.REGION - 1]            = p.region            || '';
  newRow[COLS.BRANCH - 1]            = p.branch            || p.location;
  newRow[COLS.NAME - 1]              = p.name;
  newRow[COLS.DEPARTMENT - 1]        = p.department         || '';
  newRow[COLS.POST - 1]              = p.post               || '';
  newRow[COLS.MSPIN - 1]             = p.mspin              || '';
  newRow[COLS.MOBILE - 1]            = p.mobile             || '';
  newRow[COLS.EMAIL - 1]             = p.email              || '';
  newRow[COLS.ACADEMIC - 1]          = p.academic           || '';
  newRow[COLS.PROFESSIONAL - 1]      = p.professional       || '';
  newRow[COLS.CERT_STATUS - 1]       = p.cert_status        || '';
  newRow[COLS.CERT_DETAILS - 1]      = p.cert_details       || '';
  newRow[COLS.GENDER - 1]            = p.gender             || '';
  newRow[COLS.MARITAL_STATUS - 1]    = p.marital_status     || '';
  newRow[COLS.ANNIVERSARY - 1]       = p.anniversary        || '';
  newRow[COLS.FATHERS_NAME - 1]      = p.fathers_name       || '';
  newRow[COLS.DOB - 1]               = p.dob                || '';
  newRow[COLS.PRESENT_ADDRESS - 1]   = p.present_address    || '';
  newRow[COLS.PERMANENT_ADDRESS - 1] = p.permanent_address  || '';
  newRow[COLS.DOJ - 1]               = p.doj                || '';
  newRow[COLS.MONTHS_CACL - 1]       = p.months_cacl        || '';
  newRow[COLS.AS_PER_ROLLS - 1]      = p.as_per_rolls       || '';
  newRow[COLS.AS_DMS - 1]            = p.as_dms             || '';
  newRow[COLS.MONTHS_DMS - 1]        = p.months_dms         || '';
  newRow[COLS.BASIC - 1]             = p.basic              || '';
  newRow[COLS.HRA - 1]               = p.hra                || '';
  newRow[COLS.CONVY - 1]             = p.convy              || '';
  newRow[COLS.GROSS_SALARY - 1]      = p.gross_salary       || '';
  newRow[COLS.ROLL_TYPE - 1]         = p.roll_type          || '';
  newRow[COLS.JOIN_STATUS - 1]       = p.join_status        || 'To Be Joined';
  newRow[COLS.TIMESTAMP - 1]         = ts;

  sheet.appendRow(newRow);
  return { success: true, sno: sno };
}


// ── ACTION: GET RECORDS (location-filtered) ──────────────────
function getRecords(p) {
  if (!p.location) return { success: false, error: 'Location missing' };

  const sheet   = getMasterSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };

  const allData = sheet.getRange(2, 1, lastRow - 1, COLS.TOTAL_COLS).getValues();
  const records = [];

  allData.forEach((row, i) => {
    const loc = String(row[COLS.LOCATION - 1]).toUpperCase().trim();
    if (loc === p.location.toUpperCase().trim()) {
      records.push(rowToObject(row, i + 2));  // +2 for 1-indexed + header
    }
  });

  return { success: true, data: records };
}


// ── ACTION: EDIT EMPLOYEE ────────────────────────────────────
function editEmployee(p) {
  if (!p.rowIndex) return { success: false, error: 'Row index missing' };
  if (!p.location) return { success: false, error: 'Location missing' };

  const sheet    = getMasterSheet();
  const rowIndex = Number(p.rowIndex);

  // Security: verify the row belongs to this location
  const storedLoc = String(sheet.getRange(rowIndex, COLS.LOCATION).getValue()).toUpperCase().trim();
  if (storedLoc !== p.location.toUpperCase().trim()) {
    return { success: false, error: 'Unauthorized: location mismatch' };
  }

  // Get current join status — HR cannot revert from Joined to To Be Joined
  const currentStatus = String(sheet.getRange(rowIndex, COLS.JOIN_STATUS).getValue());
  if (currentStatus === 'Joined' && p.join_status !== 'Joined') {
    return { success: false, error: 'Cannot revert Joined status. Only admin can do this.' };
  }

  // Update allowed fields
  const updates = {
    [COLS.NAME]:              p.name              || '',
    [COLS.REGION]:            p.region            || '',
    [COLS.DEPARTMENT]:        p.department        || '',
    [COLS.POST]:              p.post              || '',
    [COLS.MSPIN]:             p.mspin             || '',
    [COLS.MOBILE]:            p.mobile            || '',
    [COLS.EMAIL]:             p.email             || '',
    [COLS.ACADEMIC]:          p.academic          || '',
    [COLS.PROFESSIONAL]:      p.professional      || '',
    [COLS.CERT_STATUS]:       p.cert_status       || '',
    [COLS.CERT_DETAILS]:      p.cert_details      || '',
    [COLS.GENDER]:            p.gender            || '',
    [COLS.MARITAL_STATUS]:    p.marital_status    || '',
    [COLS.ANNIVERSARY]:       p.anniversary       || '',
    [COLS.FATHERS_NAME]:      p.fathers_name      || '',
    [COLS.DOB]:               p.dob               || '',
    [COLS.PRESENT_ADDRESS]:   p.present_address   || '',
    [COLS.PERMANENT_ADDRESS]: p.permanent_address || '',
    [COLS.DOJ]:               p.doj               || '',
    [COLS.MONTHS_CACL]:       p.months_cacl       || '',
    [COLS.AS_PER_ROLLS]:      p.as_per_rolls      || '',
    [COLS.AS_DMS]:            p.as_dms            || '',
    [COLS.MONTHS_DMS]:        p.months_dms        || '',
    [COLS.BASIC]:             p.basic             || '',
    [COLS.HRA]:               p.hra               || '',
    [COLS.CONVY]:             p.convy             || '',
    [COLS.ROLL_TYPE]:         p.roll_type         || '',
    [COLS.JOIN_STATUS]:       p.join_status       || currentStatus,
    [COLS.TIMESTAMP]:         new Date()
  };

  // Recalculate gross salary
  const basic = parseFloat(p.basic) || 0;
  const hra   = parseFloat(p.hra)   || 0;
  const convy = parseFloat(p.convy) || 0;
  updates[COLS.GROSS_SALARY] = (basic + hra + convy).toFixed(2);

  Object.entries(updates).forEach(([col, val]) => {
    sheet.getRange(rowIndex, Number(col)).setValue(val);
  });

  return { success: true };
}


// ═══════════════════════════════════════════════════════════════
//  ADMIN ACTIONS — require ADMIN_SECRET
// ═══════════════════════════════════════════════════════════════

function verifyAdmin(p) {
  return p.secret === ADMIN_SECRET;
}

// Get ALL records across all locations
function adminGetAll(p) {
  if (!verifyAdmin(p)) return { success: false, error: 'Unauthorized' };

  const sheet   = getMasterSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };

  const allData = sheet.getRange(2, 1, lastRow - 1, COLS.TOTAL_COLS).getValues();
  const records = allData
    .map((row, i) => rowToObject(row, i + 2))
    .filter(r => r.name); // skip empty rows

  return { success: true, data: records };
}

// Delete a row (admin only)
function adminDelete(p) {
  if (!verifyAdmin(p)) return { success: false, error: 'Unauthorized' };
  if (!p.rowIndex)      return { success: false, error: 'Row index missing' };

  const sheet = getMasterSheet();
  sheet.deleteRow(Number(p.rowIndex));
  return { success: true };
}

// Force-set join status (admin override)
function adminForceStatus(p) {
  if (!verifyAdmin(p)) return { success: false, error: 'Unauthorized' };
  if (!p.rowIndex)      return { success: false, error: 'Row index missing' };

  const sheet = getMasterSheet();
  sheet.getRange(Number(p.rowIndex), COLS.JOIN_STATUS).setValue(p.join_status);
  sheet.getRange(Number(p.rowIndex), COLS.TIMESTAMP).setValue(new Date());
  return { success: true };
}