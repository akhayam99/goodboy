// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store';
import { AutoReleaseContext } from '../autoReleaseContext';
import { useIsAutoOn } from '.';

const Probe = () => <p>{useIsAutoOn() ? 'auto on' : 'auto off'}</p>;

type MountParams = {
  readonly isReleased: boolean;
};

const mount = ({ isReleased }: MountParams): void => {
  render(
    <AutoReleaseContext.Provider value={isReleased}>
      <Probe />
    </AutoReleaseContext.Provider>,
  );
};

beforeEach(() => {
  useAppStore.setState({ settings: {} });
});

afterEach(cleanup);

describe('useIsAutoOn', () => {
  it('is on in the build that ships, with no switch to turn it on', () => {
    render(<Probe />);

    expect(screen.getByText('auto on')).toBeDefined();
  });

  it('stays on when an old experiment row still says false', () => {
    useAppStore.setState({ settings: { 'agents.autoExperiment': 'false' } });

    mount({ isReleased: true });

    expect(screen.getByText('auto on')).toBeDefined();
  });

  it('stays off while the release gate is closed', () => {
    mount({ isReleased: false });

    expect(screen.getByText('auto off')).toBeDefined();
  });
});
