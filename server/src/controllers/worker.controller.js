import * as workers from '../services/worker.service.js';
import { contextOf } from '../utils/context.js';

export async function list(req, res) {
  res.json(await workers.listWorkers(req.user.id, req.query));
}

export async function get(req, res) {
  res.json(await workers.getWorker(req.user.id, req.params.id));
}

export async function create(req, res) {
  res.status(201).json({ worker: await workers.createWorker(contextOf(req), req.body) });
}

export async function update(req, res) {
  res.json({ worker: await workers.updateWorker(contextOf(req), req.params.id, req.body) });
}

export async function changeRate(req, res) {
  res.json(await workers.changeRate(contextOf(req), req.params.id, req.body));
}

export async function deactivate(req, res) {
  res.json({ worker: await workers.setActive(contextOf(req), req.params.id, false) });
}

export async function reactivate(req, res) {
  res.json({ worker: await workers.setActive(contextOf(req), req.params.id, true) });
}
