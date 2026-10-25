import * as attendance from '../services/attendance.service.js';
import { contextOf } from '../utils/context.js';

export async function mark(req, res) {
  res.json(await attendance.markAttendance({ ...contextOf(req), ...req.body }));
}

export async function sheet(req, res) {
  res.json(await attendance.getSheet(req.user.id, req.query));
}

export async function list(req, res) {
  res.json(await attendance.listAttendance(req.user.id, req.query));
}

export async function calendar(req, res) {
  res.json(await attendance.getCalendar(req.user.id, req.query));
}

export async function scan(req, res) {
  res.json(await attendance.scanCard(contextOf(req), req.body.code));
}
