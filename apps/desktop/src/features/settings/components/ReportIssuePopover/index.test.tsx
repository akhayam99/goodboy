import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../../store', async () => {
  const { create } = await import('zustand');
  const { createBugReportDraftSlice } = await import('../../../../store/slices/bugReportDraft');
  const { initialBugReportDraftState } =
    await import('../../../../store/slices/bugReportDraft/state');
  const useAppStore = create((set, get) => ({
    ...initialBugReportDraftState,
    ...createBugReportDraftSlice(set as never, get as never),
  }));
  return { useAppStore };
});

import { ReportIssuePopover } from './index';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
import { useAppStore } from '../../../../store';
import { initialBugReportDraftState } from '../../../../store/slices/bugReportDraft/state';

const openPopover = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Report an issue/ }));
};

const describeIssue = (description: string) => {
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
};

beforeEach(() => {
  useAppStore.setState(initialBugReportDraftState);
});

afterEach(cleanup);

describe('ReportIssuePopover', () => {
  it('keeps what was typed when the popover closes and opens again', () => {
    render(<ReportIssuePopover />);

    openPopover();
    fireEvent.click(screen.getByRole('tab', { name: 'Idea' }));
    describeIssue('The board keeps the archived session');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Report an issue' })).toBeNull();

    openPopover();

    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
      'The board keeps the archived session',
    );
    expect(screen.getByRole('tab', { name: 'Idea' }).getAttribute('aria-selected')).toBe('true');
  });

  it('holds the draft in the store, so a fresh mount still carries it', () => {
    const first = render(<ReportIssuePopover />);
    openPopover();
    describeIssue('Terminal loses focus on resize');
    first.unmount();

    render(<ReportIssuePopover />);
    openPopover();

    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
      'Terminal loses focus on resize',
    );
  });

  it('empties the draft on a reset', () => {
    render(<ReportIssuePopover />);

    openPopover();
    describeIssue('Diff shows the wrong file');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hands the draft to the full report form and closes', () => {
    const onOpenStudio = vi.fn();
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenStudio);
    render(<ReportIssuePopover />);

    openPopover();
    describeIssue('Session cost is stale');
    fireEvent.click(screen.getByRole('button', { name: 'Add details and send' }));
    window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenStudio);

    expect(onOpenStudio).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Report an issue' })).toBeNull();
    expect(useAppStore.getState().bugReportDraft.description).toBe('Session cost is stale');
  });
});
