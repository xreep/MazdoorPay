import * as statements from '../services/statement.service.js';
import { contextOf } from '../utils/context.js';

export async function create(req, res) {
  res.status(201).json(await statements.createLink(contextOf(req), req.params.id));
}

export async function status(req, res) {
  res.json(await statements.linkStatus(req.user.id, req.params.id));
}

export async function revoke(req, res) {
  res.json(await statements.revokeLink(contextOf(req), req.params.id));
}

export async function read(req, res) {
  res.set('X-Robots-Tag', 'noindex');
  res.json(await statements.readStatement(req.params.token));
}
