// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { openingTags, productSources } from './scanControls';

const withOverride = ({ text }: { readonly text: string }): number =>
  openingTags({ text, name: 'KbdPill' }).filter((tag) => /\bclassName\b/.test(tag)).length;

describe('a key hint carries no class override', () => {
  it('counts a KbdPill that passes a className', () => {
    expect(withOverride({ text: '<KbdPill className="h-4">F</KbdPill>' })).toBe(1);
    expect(withOverride({ text: '<KbdPill aria-hidden>F</KbdPill>' })).toBe(0);
    expect(withOverride({ text: '<Kbd className="shrink-0">F</Kbd>' })).toBe(0);
  });

  it('keeps every KbdPill at its own size: a chord is bare, a single key is the plain cap', () => {
    const offenders = productSources().flatMap(({ path, text }) => {
      const count = withOverride({ text });
      return count > 0 ? [`  - ${path}: ${count}`] : [];
    });
    expect(
      offenders,
      `KbdPill takes no className. Use KeyHint (chord bare, single key as the cap) or Kbd look="inline".\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
