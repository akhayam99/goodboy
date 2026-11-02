// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PREFIXES, parseQuery } from './grammar';
import { CHAT_PREFIXES } from '../chat/components/ChatInput/lib';
import { WORKSPACE_FEATURES } from '../../shared/lib/features';

describe('quick action grammar', () => {
  it('advertises a prefix only while its capability is on', () => {
    const symbols = PREFIXES.map((prefix) => prefix.symbol);

    expect(WORKSPACE_FEATURES.workflows).toBe(true);
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

  it('places every prefix on the composer, in the palette or both', () => {
    expect(
      PREFIXES.filter(
        (prefix) => prefix.meaning.palette === null && prefix.meaning.composer === null,
      ),
    ).toEqual([]);
  });

  it('keeps the composer surface equal to the prefixes the composer reads', () => {
    expect(
      PREFIXES.filter((prefix) => prefix.meaning.composer !== null)
        .map((prefix) => prefix.symbol)
        .sort(),
    ).toEqual(CHAT_PREFIXES.map((prefix) => prefix.symbol).sort());
  });

  it('gives the palette the workflow prefix with the same symbol as the composer', () => {
    const palette = PREFIXES.filter((prefix) => prefix.meaning.palette !== null);
    const composer = PREFIXES.filter((prefix) => prefix.meaning.composer !== null);

    expect(palette.find((prefix) => prefix.group === 'workflow')?.symbol).toBe('~');
    expect(composer.find((prefix) => prefix.group === 'workflow')?.symbol).toBe('~');
  });

  it('gives a symbol the same meaning on both surfaces it appears on', () => {
    const shared = PREFIXES.filter(
      (prefix) => prefix.meaning.palette !== null && prefix.meaning.composer !== null,
    );

    expect(shared.map((prefix) => prefix.symbol).sort()).toEqual(['$', '@', '~']);
    expect(shared.filter((prefix) => prefix.meaning.palette !== prefix.meaning.composer)).toEqual(
      [],
    );
  });
});
