import * as reports from '../services/report.service.js';
import { rupees, sendReport } from '../utils/csv.js';

const STATUS_LABEL = { present: 'Present', 'half-day': 'Half day', absent: 'Absent' };
const TYPE_LABEL = { wage: 'Wage', advance: 'Advance' };
const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', bank: 'Bank' };

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'site';

export async function attendance(req, res) {
  const json = await reports.attendanceReport(req.user.id, req.query);
  sendReport(res, {
    format: req.query.format,
    filename: `attendance-${json.from}-to-${json.to}`,
    json,
    columns: [
      { key: 'day', header: 'Date' },
      { key: 'worker', header: 'Worker' },
      { key: 'role', header: 'Role' },
      { key: 'site', header: 'Site' },
      { key: 'status', header: 'Status' },
      { key: 'rate', header: 'Rate (₹)' },
      { key: 'earned', header: 'Earned (₹)' },
    ],
    rows: json.rows.map((r) => ({
      ...r,
      status: STATUS_LABEL[r.status],
      rate: rupees(r.rate),
      earned: rupees(r.earned),
    })),
  });
}

export async function musterRoll(req, res) {
  const json = await reports.musterRoll(req.user.id, req.query);
  const dayColumns = json.days.map((day) => ({ key: day, header: String(Number(day.slice(8))) }));
  sendReport(res, {
    format: req.query.format,
    filename: `muster-roll-${json.month}-${slug(json.site.name)}`,
    json,
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'role', header: 'Role' },
      ...dayColumns,
      { key: 'present', header: 'Present' },
      { key: 'halfDay', header: 'Half days' },
      { key: 'absent', header: 'Absent' },
      { key: 'earned', header: 'Earned (₹)' },
    ],
    rows: json.rows.map((r) => ({
      ...r.marks,
      name: r.name,
      role: r.role,
      present: r.present,
      halfDay: r.halfDay,
      absent: r.absent,
      earned: rupees(r.earned),
    })),
  });
}

export async function wageRegister(req, res) {
  const json = await reports.wageRegister(req.user.id, req.query);
  sendReport(res, {
    format: req.query.format,
    filename: `wage-register-${json.from}-to-${json.to}`,
    json,
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'role', header: 'Role' },
      { key: 'site', header: 'Site' },
      { key: 'present', header: 'Present' },
      { key: 'halfDay', header: 'Half days' },
      { key: 'absent', header: 'Absent' },
      { key: 'rates', header: 'Rates' },
      { key: 'gross', header: 'Gross (₹)' },
      { key: 'advancesPaid', header: 'Advances paid (₹)' },
      { key: 'wagesPaid', header: 'Wages paid (₹)' },
      { key: 'balance', header: 'Balance (₹)' },
    ],
    rows: json.rows.map((r) => ({
      ...r,
      gross: rupees(r.gross),
      advancesPaid: rupees(r.advancesPaid),
      wagesPaid: rupees(r.wagesPaid),
      balance: rupees(r.balance),
    })),
  });
}

export async function payments(req, res) {
  const json = await reports.paymentsReport(req.user.id, req.query);
  sendReport(res, {
    format: req.query.format,
    filename: `payments-${json.from}-to-${json.to}`,
    json,
    columns: [
      { key: 'day', header: 'Date' },
      { key: 'worker', header: 'Worker' },
      { key: 'type', header: 'Type' },
      { key: 'method', header: 'Method' },
      { key: 'reference', header: 'Reference' },
      { key: 'amount', header: 'Amount (₹)' },
      { key: 'status', header: 'Status' },
      { key: 'notes', header: 'Notes' },
    ],
    rows: json.rows.map((r) => ({
      ...r,
      type: TYPE_LABEL[r.type],
      method: METHOD_LABEL[r.method],
      amount: rupees(r.amount),
    })),
  });
}
