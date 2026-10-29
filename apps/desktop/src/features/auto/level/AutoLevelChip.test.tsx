// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AutoLevelChip } from './AutoLevelChip';

afterEach(cleanup);

describe('AutoLevelChip', () => {
  it('shows the level and where it comes from', () => {
    render(
      <AutoLevelChip
        value="plan"
        isPicked={false}
        workspaceName="Harborline"
        isDisabled={false}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText('After the plan')).toBeDefined();
    expect(screen.getByText('from Harborline')).toBeDefined();
  });

  it('hands back the level picked in the popover', () => {
    const onPick = vi.fn();
    render(
      <AutoLevelChip
        value="plan"
        isPicked
        workspaceName="Harborline"
        isDisabled={false}
        onPick={onPick}
      />,
    );

    fireEvent.click(screen.getByText('After the plan'));
    fireEvent.click(screen.getByRole('tab', { name: 'Every step' }));

    expect(onPick).toHaveBeenCalledWith({ next: 'step' });
  });
});
