// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../worktree/BranchSwitchPanel', () => ({
  BranchSwitchPanel: ({ onDone }: { onDone: () => void }) => (
    <button type="button" onClick={onDone}>
      Complete switch
    </button>
  ),
}));

import { BranchChip } from './BranchChip';

const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  toastMock.mockReset();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});
afterEach(cleanup);

describe('BranchChip', () => {
  it('renders the branch name', () => {
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit />);
    expect(screen.getByText('ak/feat-thing')).toBeDefined();
  });

  it('copies the branch and toasts success on click', async () => {
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy branch ak/feat-thing' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ak/feat-thing'));
    expect(toastMock).toHaveBeenCalledWith('success', 'branch copied');
  });

  it('toasts an error when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy branch ak/feat-thing' }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('error', expect.stringMatching(/copy failed/i)),
    );
  });

  it('reveals the edit affordance and closes its popover after switching', () => {
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit />);
    const edit = screen.getByRole('button', { name: 'Edit branch' });

    expect(edit.className).toContain('opacity-0');
    expect(edit.className).toContain('focus-visible:opacity-100');
    fireEvent.click(edit);
    expect(screen.getByRole('dialog', { name: 'Switch branch' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Complete switch' }));
    expect(screen.queryByRole('dialog', { name: 'Switch branch' })).toBeNull();
  });

  it('hides branch editing when the workspace cannot switch branches', () => {
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit={false} />);

    expect(screen.queryByRole('button', { name: 'Edit branch' })).toBeNull();
  });

  it('drops the native title in favor of the house tooltip on the edit control', () => {
    render(<BranchChip branch="ak/feat-thing" sessionId={'sess-1' as never} canEdit />);
    const edit = screen.getByRole('button', { name: 'Edit branch' });

    expect(edit.getAttribute('title')).toBeNull();
  });
});
