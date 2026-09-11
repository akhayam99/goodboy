import { describe, expect, it } from 'vitest';
import { PREFIXES, parseQuery } from './grammar';
import { WORKSPACE_FEATURES } from '../../shared/lib/features';

describe('quick action grammar', () => {
  it('advertises a prefix only while its capability is on', () => {
    const symbols = PREFIXES.map((prefix) => prefix.symbol);

    expect(WORKSPACE_FEATURES.skills).toBe(false);
    expect(symbols).not.toContain('/');
    expect(symbols).toContain('~');
    expect(symbols).toContain('$');
    expect(symbols).toContain('@');
  });

  it('does not parse a disabled prefix as a filter', () => {
    expect(parseQuery('/release-notes')).toEqual({ prefix: null, query: '/release-notes' });
  });

  it('still parses an enabled prefix', () => {
    expect(parseQuery('$ build')).toEqual({
      prefix: PREFIXES.find((prefix) => prefix.symbol === '$'),
      query: 'build',
    });
  });

  it('carries a short noun for compact surfaces and a longer hint for the palette', () => {
    const agents = PREFIXES.find((prefix) => prefix.symbol === '@');

    expect(agents?.noun).toBe('agents');
    expect(agents?.hint).toBe('agents in current session');
  });
});
