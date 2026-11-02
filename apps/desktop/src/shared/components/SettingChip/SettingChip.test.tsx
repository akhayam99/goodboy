import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDropdown } from '@goodboy/ui';
import { SettingChip } from '.';
import type { SettingWords } from './settingWords';

type HarnessProps = {
  readonly words: SettingWords;
};

const Harness = ({ words }: HarnessProps) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 280, width: 'w-72' });
  return (
    <SettingChip
      dropdown={dropdown}
      label="Edits"
      words={words}
      help="What agents may do."
      error={null}
    >
      <span>Body</span>
    </SettingChip>
  );
};

describe('SettingChip', () => {
  it('reads Label: value and keeps the source out of the trigger', () => {
    render(
      <Harness
        words={{ value: 'Full access', source: 'from Harborline', chain: 'From Harborline.' }}
      />,
    );

    const trigger = screen.getByRole('button', { name: /^Edits: Full access/ });
    expect(trigger.textContent).toBe('Edits:Full access');
    expect(trigger.hasAttribute('data-setting-changed')).toBe(false);
  });

  it('tints the chip when the value differs from the default', () => {
    render(
      <Harness
        words={{
          value: 'Ask first',
          source: 'this session',
          chain: 'This session.',
          isChanged: true,
        }}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: /^Edits: Ask first/ })
        .hasAttribute('data-setting-changed'),
    ).toBe(true);
  });
});
