// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AutoLevelChip } from '.';

afterEach(cleanup);

describe('AutoLevelChip', () => {
  it('shows the level and says it comes from the workspace when it matches', () => {
    render(
      <AutoLevelChip
        value="plan"
        workspaceLevel="plan"
        workspaceName="Harborline"
        error={null}
        isDisabled={false}
        onPick={vi.fn()}
      />,
    );

    screen.getByText('After the plan');
    screen.getByText('from Harborline');
  });

  it('says this run when the level differs from the workspace default', () => {
    render(
      <AutoLevelChip
        value="step"
        workspaceLevel="plan"
        workspaceName="Harborline"
        error={null}
        isDisabled={false}
        onPick={vi.fn()}
      />,
    );

    screen.getByText('this run');
  });

  it('hands back the level picked in the popover', () => {
    const onPick = vi.fn();
    render(
      <AutoLevelChip
        value="plan"
        workspaceLevel="plan"
        workspaceName="Harborline"
        error={null}
        isDisabled={false}
        onPick={onPick}
      />,
    );

    fireEvent.click(screen.getByText('After the plan'));
    fireEvent.click(screen.getByRole('tab', { name: 'Every step' }));

    expect(onPick).toHaveBeenCalledWith({ next: 'step' });
  });
});
