// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import type { WorkTime } from '../../../workTreeModel/workTime';
import { AgentHeaderTime } from './AgentHeaderTime';

afterEach(cleanup);

const LONGER: WorkTime = {
  label: '13m 13s',
  detail: 'Running 13m 13s. Most finish within 10m. Based on 12 similar runs.',
  progress: 1,
  headline: '13m 13s · longer than usual',
  note: 'Longer than usual',
  isMuchLonger: false,
};

const ON_TRACK: WorkTime = {
  label: '~3-7m left',
  detail: 'Running 4m 12s. Usually 6-9m.',
  progress: 0.4,
  headline: '4m · ~3-7m left',
  note: null,
  isMuchLonger: false,
};

describe('AgentHeaderTime', () => {
  it('shows elapsed and time left as one line while on track', () => {
    render(<AgentHeaderTime time={ON_TRACK} />);

    expect(screen.getByTestId('agent-header-time').textContent).toBe('4m · ~3-7m left');
    expect(screen.getByTestId('agent-header-time').dataset.note).toBeUndefined();
  });

  it('shows only the elapsed time, warm, when it runs longer than usual', () => {
    render(<AgentHeaderTime time={LONGER} />);

    const time = screen.getByTestId('agent-header-time');
    expect(time.textContent).toBe('13m 13s');
    expect(time.dataset.note).toBe('true');
    expect(time.textContent).not.toMatch(/longer than usual/iu);
  });

  it('keeps the note in the tooltip and for screen readers', () => {
    render(<AgentHeaderTime time={LONGER} />);

    expect(tooltipTextOf({ element: screen.getByTestId('agent-header-time') })).toContain(
      'Longer than usual. Running 13m 13s.',
    );
    expect(screen.getByText('Longer than usual')).toBeDefined();
  });
});
