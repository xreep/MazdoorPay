import * as admin from '../services/admin.service.js';
import { sendReport } from '../utils/csv.js';

const adminContext = (req) => ({ actor: { id: req.user.id, role: req.user.role }, ip: req.ip });

const KPI_LABELS = {
  contractors: 'Contractors',
  activeContractors7d: 'Contractors active in last 7 days',
  activeContractors30d: 'Contractors active in last 30 days',
  engagementRate7d: 'Engagement rate, 7 days (%)',
  workersManaged: 'Workers managed',
  attendanceRecords: 'Attendance records',
  paymentAccuracyPct: 'Payment accuracy (%)',
  digitalReferencePct: 'Digital payments with reference (%)',
};

export const overview = async (_req, res) => res.json(await admin.getOverview());
export const growth = async (req, res) => res.json(await admin.getGrowth(req.query));
export const users = async (req, res) => res.json(await admin.listUsers(req.query));
export const user = async (req, res) => res.json(await admin.getUser(req.params.id));
export const activity = async (req, res) => res.json(await admin.listActivity(req.query));
export const anomalies = async (_req, res) => res.json(await admin.findAnomalies());

export async function suspend(req, res) {
  res.json({ user: await admin.suspendUser(adminContext(req), req.params.id, req.body.reason) });
}

export async function reactivate(req, res) {
  res.json({ user: await admin.reactivateUser(adminContext(req), req.params.id) });
}

export async function kpis(req, res) {
  const json = await admin.getKpis();
  sendReport(res, {
    format: req.query.format,
    filename: `kpis-${new Date().toISOString().slice(0, 10)}`,
    json,
    columns: [
      { key: 'metric', header: 'Metric' },
      { key: 'value', header: 'Value' },
    ],
    rows: Object.entries(json).map(([key, value]) => ({ metric: KPI_LABELS[key], value })),
  });
}
