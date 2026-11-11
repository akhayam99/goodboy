// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QUIET_TOOL_HEALTH } from '../../../../../__tests__/helpers/quietToolHealth';
import { SettingsSearchResults } from './index';
import { settingsDirectory, type SettingsStatus } from '../settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: undefined,
    providersTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [
    {
      id: 'anthropic',
      label: 'Claude',
      status: { subtitle: 'Claude is about to run out', tone: 'warning' },
    },
  ],
  tools: [
    {
      tool: 'linear',
      label: 'Linear',
      subtitle: 'Not connected',
      isConnected: false,
      health: QUIET_TOOL_HEALTH,
    },
  ],
};

const GROUPS = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });

afterEach(cleanup);

type MountParams = {
  readonly query: string;
};

const mount = ({ query }: MountParams) => {
  const onOpen = vi.fn();
  const onPicked = vi.fn();
  render(
    <SettingsSearchResults groups={GROUPS} query={query} onOpen={onOpen} onPicked={onPicked} />,
  );
  return { onOpen, onPicked };
};

describe('SettingsSearchResults', () => {
  it('lists the matching settings and opens the one picked', () => {
    const { onOpen, onPicked } = mount({ query: 'claude' });

    const results = screen.getByRole('list', { name: 'Matching settings' });
    fireEvent.click(within(results).getByRole('button', { name: /Claude/ }));

    expect(onPicked).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith({ scope: 'providers', provider: 'anthropic' });
  });

  it('says so when nothing matches', () => {
    mount({ query: 'no such page' });

    screen.getByText('No settings match');
  });
});
