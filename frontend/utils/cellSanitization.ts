/**
 * Sanitize a value before writing it as a string cell in XLSX or clipboard output.
 *
 * Excel (and Google Sheets) treat cells whose text begins with `=`, `+`, `-`,
 * `@`, tab, or carriage-return as formula / special syntax.  Prefixing such
 * values with a single quote causes the spreadsheet application to treat the
 * cell as plain text, preventing formula-injection attacks (CSV/XLSX injection).
 *
 * Only use this function when the cell value will be rendered as a **string**.
 * Numeric, date, and boolean cell values are never formula-injected and should
 * NOT be passed through this helper.
 */
export function sanitizeForCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Prefix dangerous leading characters with a single quote to prevent formula execution
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}
