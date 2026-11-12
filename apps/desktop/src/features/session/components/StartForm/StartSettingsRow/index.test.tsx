import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StartSettingItem } from '../startSettingsOf';
import { StartSettingsRow } from '.';

const itemOf = (key: StartSettingItem['key'], isChanged: boolean): StartSettingItem => ({
  key,
  node: <span>{key}</span>,
  isChanged,
});

describe('StartSettingsRow', () => {
  afterEach(cleanup);

  it('keeps Asks you, Limit and Guidance under More', () => {
    render(
      <StartSettingsRow
        items={[
          itemOf('where', false),
          itemOf('asks', false),
          itemOf('edits', false),
          itemOf('limit', false),
          itemOf('guidance', false),
        ]}
      />,
    );

    expect(screen.queryByText('asks')).toBeNull();
    expect(screen.queryByText('limit')).toBeNull();
    expect(screen.queryByText('guidance')).toBeNull();
    screen.getByText('edits');
    fireEvent.click(screen.getByRole('button', { name: 'More 3' }));
    screen.getByText('asks');
    screen.getByText('limit');
    screen.getByText('guidance');
    screen.getByRole('button', { name: 'Less' });
  });

  it('promotes a setting that differs from its default out of More', () => {
    render(
      <StartSettingsRow
        items={[itemOf('edits', false), itemOf('limit', true), itemOf('guidance', false)]}
      />,
    );

    screen.getByText('limit');
    expect(screen.queryByText('guidance')).toBeNull();
    screen.getByRole('button', { name: 'More 1' });
  });

  it('draws no More when every setting is always shown', () => {
    render(<StartSettingsRow items={[itemOf('where', false), itemOf('edits', false)]} />);

    expect(screen.queryByRole('button', { name: /^More/ })).toBeNull();
  });
});
