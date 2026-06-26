/**
 * BE-021: Centralised, injection-safe ORDER BY builder.
 *
 * All dynamic ORDER BY clauses must go through this helper so that
 * arbitrary column names can never be injected into raw SQL.
 *
 * @param orderBy    - Caller-supplied column alias (from query params / DTO).
 * @param direction  - Sort direction string from caller ("ASC" | "DESC" | anything).
 * @param columnMap  - Whitelist mapping alias → qualified SQL column expression.
 * @param fallback   - SQL column to use when orderBy is not in the whitelist.
 *                     Defaults to the first value in columnMap, or "" if the map is empty.
 * @returns          - A safe `ORDER BY <col> <dir>` SQL fragment.
 *
 * @example
 * ```typescript
 * const orderBy = safeOrderBy(
 *   query.orderBy,
 *   query.direction,
 *   { id: 'o.id', created_at: 'o.order_time' },
 *   'o.order_time',
 * );
 * // → "ORDER BY o.order_time DESC"
 * ```
 */
export function safeOrderBy(
  orderBy: string | undefined,
  direction: string | undefined,
  columnMap: Record<string, string>,
  fallback?: string,
): string {
  const resolvedFallback =
    fallback ?? (Object.values(columnMap)[0] as string | undefined) ?? "";
  const column =
    orderBy !== undefined && orderBy in columnMap
      ? columnMap[orderBy]
      : resolvedFallback;
  const dir = direction === "ASC" ? "ASC" : "DESC";
  return `ORDER BY ${column} ${dir}`;
}
