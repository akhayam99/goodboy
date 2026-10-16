// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { MOVE_TO_AUTO_EVENT } from '../../../auto/adopt/moveToAutoEvent';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { AutoHandoffChip } from './AutoHandoffChip';

const AGENT = brandId<AgentId>({ value: 'agent-source' });

beforeEach(() => {
  useAppStore.setState({ settings: {} });
});

afterEach(cleanup);

type MountParams = {
  readonly isReleased?: boolean;
};

const mount = ({ isReleased = true }: MountParams = {}): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <AutoHandoffChip reason="Needs a tester and a reviewer" agentId={AGENT} />
    </AutoReleaseContext.Provider>,
  );
};

describe('the chip where an agent suggests Auto', () => {
  it('shows the reason and asks the pane to open the Move to Auto panel', async () => {
    const heard: Array<unknown> = [];
    const listen = (event: Event) => {
      heard.push(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener(MOVE_TO_AUTO_EVENT, listen);
    mount();

    expect(await screen.findByText('Agent suggests: Auto')).toBeDefined();
    expect(screen.getByText('Needs a tester and a reviewer')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Move to Auto' }));
    window.removeEventListener(MOVE_TO_AUTO_EVENT, listen);

    await waitFor(() => expect(heard).toEqual([{ agentId: AGENT }]));
  });

  it('shows the chip even when an old experiment row still says false', () => {
    useAppStore.setState({ settings: { 'agents.autoExperiment': 'false' } });
    mount();

    expect(screen.getByText('Agent suggests: Auto')).toBeDefined();
  });

  it('stays hidden while the release gate is closed', () => {
    mount({ isReleased: false });

    expect(screen.queryByText('Agent suggests: Auto')).toBeNull();
  });
});
