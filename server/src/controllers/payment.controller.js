import * as payments from '../services/payment.service.js';
import { contextOf } from '../utils/context.js';

export async function create(req, res) {
  const result = await payments.recordPayment({ ...contextOf(req), input: req.body });
  res
    .status(result.replayed ? 200 : 201)
    .json({ payment: result.payment, balance: result.balance });
}

export async function list(req, res) {
  res.json(await payments.listPayments(req.user.id, req.query));
}

export async function dues(req, res) {
  res.json(await payments.getDues(req.user.id, req.query));
}

export async function get(req, res) {
  res.json(await payments.getPayment(req.user.id, req.params.id));
}

export async function voidOne(req, res) {
  res.json(
    await payments.voidPayment({
      ...contextOf(req),
      paymentId: req.params.id,
      reason: req.body.reason,
    })
  );
}
