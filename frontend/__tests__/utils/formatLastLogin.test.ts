import { format } from 'date-fns';
import { formatLastLogin, lastLoginToDate } from '@/utils/formatLastLogin';

// 2018-06-06T07:48:09Z — a real value from credentials.last_login on staging
const LEGACY_SECONDS = 1528271289;

describe('lastLoginToDate', () => {
  test('treats a number as legacy unix seconds, not milliseconds', () => {
    expect(lastLoginToDate(LEGACY_SECONDS)?.toISOString()).toBe('2018-06-06T07:48:09.000Z');
  });

  test('treats a numeric string as unix seconds too', () => {
    expect(lastLoginToDate('1528271289')?.toISOString()).toBe('2018-06-06T07:48:09.000Z');
  });

  test('parses an ISO string', () => {
    expect(lastLoginToDate('2024-01-15T10:30:00Z')?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  test.each([0, '0', null, undefined, ''])('returns null for "never logged in" value %p', (value) => {
    expect(lastLoginToDate(value)).toBeNull();
  });

  test('returns null for garbage', () => {
    expect(lastLoginToDate('not a date')).toBeNull();
    expect(lastLoginToDate({})).toBeNull();
  });
});

describe('formatLastLogin', () => {
  test('renders legacy seconds as a readable local date + time', () => {
    const expected = format(new Date(LEGACY_SECONDS * 1000), 'd MMM yyyy, HH:mm');
    expect(formatLastLogin(LEGACY_SECONDS)).toBe(expected);
    expect(formatLastLogin(LEGACY_SECONDS)).not.toContain('1970');
  });

  test('renders an ISO string as a readable local date + time', () => {
    const expected = format(new Date('2024-01-15T10:30:00Z'), 'd MMM yyyy, HH:mm');
    expect(formatLastLogin('2024-01-15T10:30:00Z')).toBe(expected);
  });

  test.each([0, null, undefined])('renders "Never" for %p', (value) => {
    expect(formatLastLogin(value)).toBe('Never');
  });
});
