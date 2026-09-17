import { format, isValid } from 'date-fns';

/**
 * `credentials.last_login` in the legacy schema is a unix timestamp in
 * **seconds** (0 = never logged in), so it arrives here as a number or a
 * numeric string. Newer code paths may hand us an ISO string instead.
 * Returns null for "never" / unparseable input.
 */
export function lastLoginToDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const seconds = Number(value);
    return seconds > 0 ? new Date(seconds * 1000) : null;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return isValid(date) ? date : null;
  }

  return null;
}

/**
 * Human-readable local date + time, e.g. "6 Jun 2018, 10:28".
 * Day-first with a month name is unambiguous for the US, UK and EU users
 * sharing this app.
 */
export function formatLastLogin(value: unknown): string {
  const date = lastLoginToDate(value);
  return date ? format(date, 'd MMM yyyy, HH:mm') : 'Never';
}
