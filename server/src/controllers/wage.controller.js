import { getWageSummary } from '../services/wage.service.js';

export async function summary(req, res) {
  res.json(await getWageSummary(req.user.id, req.query));
}
