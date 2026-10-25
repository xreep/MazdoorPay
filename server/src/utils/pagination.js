export const pageResult = (items, total, { page, limit }) => ({
  data: items,
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

export const skipFor = ({ page, limit }) => (page - 1) * limit;
