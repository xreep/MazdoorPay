// Who is acting, for which tenant, from where. Contractors are their own tenant.
export const contextOf = (req) => ({
  actor: { id: req.user.id, role: req.user.role },
  contractorId: req.user.id,
  ip: req.ip,
});
