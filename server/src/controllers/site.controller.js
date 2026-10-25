import * as sites from '../services/site.service.js';
import { contextOf } from '../utils/context.js';

export async function list(req, res) {
  res.json({ sites: await sites.listSites(req.user.id, req.query) });
}

export async function get(req, res) {
  res.json(await sites.getSite(req.user.id, req.params.id));
}

export async function create(req, res) {
  res.status(201).json({ site: await sites.createSite(contextOf(req), req.body) });
}

export async function update(req, res) {
  res.json({ site: await sites.updateSite(contextOf(req), req.params.id, req.body) });
}

export async function remove(req, res) {
  await sites.deleteSite(contextOf(req), req.params.id);
  res.status(204).end();
}
