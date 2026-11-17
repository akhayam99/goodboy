import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StartSettingItem, StartSettingWords } from '../startSettingsOf';
import { StartSettingsRow } from '.';

type ItemParams = {
  readonly key: StartSettingItem['key'];
  readonly words: StartSettingWords | null;
};

const itemOf = ({ key, words }: ItemParams): StartSettingItem => ({
  key,
  node: <span>{`${key} chip`}</span>,
  isChanged: false,
  words,
});

const ITEMS: ReadonlyArray<StartSettingItem> = [
  itemOf({ key: 'where', words: { lead: '', value: 'harbor-portal' } }),
  itemOf({ key: 'asks', words: { lead: 'Stops', value: 'after the plan' } }),
  itemOf({ key: 'edits', words: { lead: 'Edits', value: 'full access' } }),
  itemOf({ key: 'limit', words: { lead: 'Limit', value: '$8.00' } }),
  itemOf({ key: 'guidance', words: null }),
];

const line = (): string => document.querySelector('[data-start-settings-line]')?.textContent ?? '';

describe('StartSettingsRow', () => {
  afterEach(cleanup);

  it('reads the settings as one sentence, stops first and the projects last', () => {
    render(<StartSettingsRow items={ITEMS} />);

    expect(line()).toBe('Stops after the plan · Edits full access · Limit $8.00 · harbor-portal');
    expect(screen.queryByText('edits chip')).toBeNull();
  });

  it('opens every control under Change and closes them on Done', () => {
    render(<StartSettingsRow items={ITEMS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    for (const key of ['where', 'asks', 'edits', 'limit', 'guidance']) {
      screen.getByText(`${key} chip`);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('limit chip')).toBeNull();
  });

  it('draws nothing when no setting applies', () => {
    render(<StartSettingsRow items={[]} />);

    expect(screen.queryByRole('group', { name: 'Run settings' })).toBeNull();
  });
});
