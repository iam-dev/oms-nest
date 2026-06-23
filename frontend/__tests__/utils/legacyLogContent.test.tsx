import { render } from '@testing-library/react';
import { renderLegacyLogContent } from '@/utils/legacyLogContent';

function html(node: ReturnType<typeof renderLegacyLogContent>): string {
  const { container } = render(<>{node}</>);
  return container.innerHTML;
}

describe('renderLegacyLogContent', () => {
  it('renders empty/null input as null', () => {
    expect(renderLegacyLogContent('')).toBeNull();
  });

  it('returns plain text unchanged', () => {
    expect(html(renderLegacyLogContent('Changed the order status to "Approved"')))
      .toBe('Changed the order status to "Approved"');
  });

  it('converts <br> to a line break', () => {
    expect(html(renderLegacyLogContent('commented:<br>next line')))
      .toBe('commented:<br>next line');
  });

  it('renders <i>…</i> as <em>…</em>', () => {
    expect(html(renderLegacyLogContent('say <i>hi</i>')))
      .toBe('say <em>hi</em>');
  });

  it('renders <b>…</b> as <strong>…</strong>', () => {
    expect(html(renderLegacyLogContent('really <b>important</b>')))
      .toBe('really <strong>important</strong>');
  });

  it('unescapes \\" sequences to literal quotes', () => {
    expect(html(renderLegacyLogContent('\\"hello\\"')))
      .toBe('"hello"');
  });

  it('renders the legacy commented payload from the screenshot', () => {
    const input = 'commented:<br>\\" <i>extra panel shipped</i> \\"';
    expect(html(renderLegacyLogContent(input)))
      .toBe('commented:<br>" <em>extra panel shipped</em> "');
  });

  it('passes unknown tags through as escaped text', () => {
    expect(html(renderLegacyLogContent('<script>alert(1)</script>')))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
