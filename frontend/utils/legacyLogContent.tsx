import { Fragment, ReactNode } from 'react';

// Legacy OMS stored activity-log entries as pre-formatted HTML in `log.text`
// (e.g. `commented:<br>\" <i>extra panel shipped</i> \"`). Render that
// allowlist (<br>, <i>/<em>, <b>/<strong>) as real React nodes; pass plain
// text through unchanged. Unknown tags are shown as literal text.
export function renderLegacyLogContent(input: string): ReactNode {
  if (!input) return null;
  const unescaped = input.replace(/\\"/g, '"');
  const lines = unescaped.split(/<br\s*\/?>/i);
  return (
    <>
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderInline(line, lineIdx)}
        </Fragment>
      ))}
    </>
  );
}

function renderInline(line: string, lineIdx: number): ReactNode[] {
  const parts: ReactNode[] = [];
  const tagRe = /<(i|em|b|strong)>([\s\S]*?)<\/\1>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(line)) !== null) {
    if (match.index > cursor) parts.push(line.slice(cursor, match.index));
    const tag = match[1].toLowerCase();
    const Tag = tag === 'i' || tag === 'em' ? 'em' : 'strong';
    parts.push(
      <Tag key={`${lineIdx}-${match.index}`}>{match[2]}</Tag>,
    );
    cursor = tagRe.lastIndex;
  }
  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}
