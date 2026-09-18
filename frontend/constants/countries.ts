/**
 * Country names as stored in the legacy `customers.country` / `fitters.country`
 * columns (free text written by the PHP form's "- Choose -" dropdown).
 *
 * Derived from the distinct values present in the production data, so a value
 * picked here is guaranteed to match existing rows for filtering and reports.
 * Ordered by frequency of use, then alphabetically.
 */
export const CUSTOMER_COUNTRIES: ReadonlyArray<string> = [
  'United States',
  'Netherlands',
  'Canada',
  'United Kingdom',
  'Germany',
  'Spain',
  'Belgium',
  'Denmark',
  'Austria',
  'Australia',
  'Argentina',
  'Brazil',
  'China',
  'Czech Republic',
  'Finland',
  'France',
  'India',
  'Israel',
  'Italy',
  'Japan',
  'Mexico',
  'New Zealand',
  'Norway',
  'Portugal',
  'Republic of Ireland',
  'Romania',
  'Russia',
  'Sweden',
  'Switzerland',
  'Ukraine',
];
