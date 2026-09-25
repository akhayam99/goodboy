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

import { ReportIssueForm } from './index';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
import { useAppStore } from '../../../../store';
import { initialBugReportDraftState } from '../../../../store/slices/bugReportDraft/state';

const describeIssue = (description: string) => {
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
};

const screenshot = ({ name, sizeBytes = 1024 }: { name: string; sizeBytes?: number }): File => {
  const file = new File(['shot'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
};

const pasteFiles = (files: ReadonlyArray<File>) => {
  fireEvent.paste(screen.getByLabelText('Description'), { clipboardData: { files } });
};

beforeEach(() => {
  useAppStore.setState(initialBugReportDraftState);
});

afterEach(cleanup);

describe('ReportIssueForm', () => {
  it('holds the draft in the store, so a fresh mount still carries it', () => {
    const first = render(<ReportIssueForm onOpenFullForm={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Idea' }));
    describeIssue('Terminal loses focus on resize');
    first.unmount();

    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
      'Terminal loses focus on resize',
    );
    expect(screen.getByRole('tab', { name: 'Idea' }).getAttribute('aria-selected')).toBe('true');
  });

  it('empties the draft on a reset', () => {
    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    describeIssue('Diff shows the wrong file');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hands the draft to the full report form', () => {
    const onOpenStudio = vi.fn();
    const onOpenFullForm = vi.fn();
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenStudio);
    render(<ReportIssueForm onOpenFullForm={onOpenFullForm} />);

    describeIssue('Session cost is stale');
    fireEvent.click(screen.getByRole('button', { name: 'Add details and send' }));
    window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenStudio);

    expect(onOpenStudio).toHaveBeenCalledOnce();
    expect(onOpenFullForm).toHaveBeenCalledOnce();
    expect(useAppStore.getState().bugReportDraft.description).toBe('Session cost is stale');
  });

  it('attaches a pasted screenshot and shows it as a thumbnail', async () => {
    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    pasteFiles([screenshot({ name: 'board.png' })]);

    const thumbnail = (await screen.findByAltText('board.png')) as HTMLImageElement;
    expect(thumbnail.src.startsWith('data:image/png')).toBe(true);
    expect(useAppStore.getState().bugReportDraft.images).toHaveLength(1);
  });

  it('drops a pasted screenshot again from its remove button', async () => {
    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    pasteFiles([screenshot({ name: 'board.png' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove board.png' }));

    expect(screen.queryByAltText('board.png')).toBeNull();
    expect(useAppStore.getState().bugReportDraft.images).toHaveLength(0);
  });

  it('refuses a screenshot over the size cap and says why', async () => {
    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    pasteFiles([screenshot({ name: 'huge.png', sizeBytes: 6 * 1024 * 1024 })]);

    expect(await screen.findByText('huge.png is over 5MB.')).toBeDefined();
    expect(useAppStore.getState().bugReportDraft.images).toHaveLength(0);
  });

  it('keeps the attached screenshots across a fresh mount', async () => {
    const first = render(<ReportIssueForm onOpenFullForm={vi.fn()} />);
    pasteFiles([screenshot({ name: 'board.png' })]);
    await screen.findByAltText('board.png');
    first.unmount();

    render(<ReportIssueForm onOpenFullForm={vi.fn()} />);

    expect(screen.getByAltText('board.png')).toBeDefined();
  });
});
