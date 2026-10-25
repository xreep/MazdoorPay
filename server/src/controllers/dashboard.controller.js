import { getDashboard } from '../services/dashboard.service.js';

export async function show(req, res) {
  res.json(await getDashboard(req.user.id));
}
