// Service for fetching reports data
import { fetchReports } from './api';

export async function getReports(params: Record<string, unknown> = {}) {
  return fetchReports(params);
}
