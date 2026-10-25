import { api } from './api.js';

// Fetches a CSV with the user's credentials and saves it with a readable name.
export async function downloadCsv(path, query, filename) {
  const blob = await api.blob(path, { query: { ...query, format: 'csv' } });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
