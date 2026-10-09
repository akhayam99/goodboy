// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { openingTags, productSources } from './scanControls';

const STATE_WORD = /['"`]\s*(?:On|Off)\s*['"`]/;

const ALLOWLIST: ReadonlyArray<string> = [
  'apps/desktop/src/features/settings/components/SettingsStudio/LegacyLayoutField.tsx',
];

const stateLabels = ({ text }: { readonly text: string }): number =>
  openingTags({ text, name: 'Switch' }).filter((tag) => STATE_WORD.test(tag)).length;

describe('a switch names the setting, never On or Off', () => {
  it('counts a state word in a Switch tag and leaves a setting name alone', () => {
    expect(stateLabels({ text: "<Switch label={on ? 'On' : 'Off'} checked={on} />" })).toBe(1);
    expect(stateLabels({ text: '<Switch ariaLabel="Parallel agents" checked={on} />' })).toBe(0);
    expect(stateLabels({ text: '<Switch label="Include drafts" checked={on} />' })).toBe(0);
  });

  it('keeps every Switch label free of a visible On or Off', () => {
    const offenders = productSources().flatMap(({ path, text }) => {
      const count = ALLOWLIST.includes(path) ? 0 : stateLabels({ text });
      return count > 0 ? [`  - ${path}: ${count}`] : [];
    });
    expect(
      offenders,
      `A Switch label names the setting. Put the setting in ariaLabel and show no state word.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('points the allowlist at files that still exist', () => {
    const paths = new Set(productSources().map(({ path }) => path));
    expect(ALLOWLIST.filter((path) => !paths.has(path))).toEqual([]);
  });
});
