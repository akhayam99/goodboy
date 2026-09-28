// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ReportSheet, type ReportSheetAttachment } from '../components/ReportSheet';

afterEach(cleanup);

const ATTACHMENTS: ReadonlyArray<ReportSheetAttachment> = [
  { id: 'version', label: '0.12.0', included: true },
  { id: 'system', label: 'macOS 26.0 arm64', included: true },
  { id: 'screen', label: 'Board', included: false },
];

type HarnessProps = {
  readonly onSubmit?: () => void;
  readonly onClose?: () => void;
  readonly onToggle?: (id: string) => void;
  readonly canSubmit?: boolean;
};

const Harness = ({
  onSubmit = vi.fn(),
  onClose,
  onToggle = vi.fn(),
  canSubmit = true,
}: HarnessProps) => {
  const [line, setLine] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <ReportSheet
      heading="Report a bug"
      line={line}
      linePlaceholder="What went wrong"
      onLineChange={setLine}
      detail={detail}
      detailPlaceholder="Steps"
      onDetailChange={setDetail}
      attachments={ATTACHMENTS}
      onToggleAttachment={onToggle}
      preview={`${line}\n\nVersion: 0.12.0`}
      previewSummary="nothing redacted"
      neverSent="Never sent: prompts and replies."
      destination="Public issue on GitHub as @rowan"
      submitLabel="Send"
      isSubmitting={false}
      canSubmit={canSubmit}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
};

describe('ReportSheet', () => {
  it('puts the cursor in the one line', () => {
    render(<Harness />);

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /one line/i }));
  });

  it('sends on command enter from the line', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const line = screen.getByRole('textbox', { name: /one line/i });
    fireEvent.change(line, { target: { value: 'Board columns jump' } });
    fireEvent.keyDown(line, { key: 'Enter', metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not send on command enter while it cannot', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} canSubmit={false} />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: /one line/i }), {
      key: 'Enter',
      metaKey: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens the detail field on tab and focuses it', () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: /one line/i }), { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Detail' }));
    expect(screen.queryByRole('button', { name: /add detail/i })).toBeNull();
  });

  it('shows every attached part and removes or restores each one', () => {
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove macOS 26.0 arm64' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach Board' }));

    expect(onToggle.mock.calls).toEqual([['system'], ['screen']]);
  });

  it('shows the exact text that leaves when the preview opens', () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole('textbox', { name: /one line/i }), {
      target: { value: 'Board columns jump' },
    });
    fireEvent.click(screen.getByRole('button', { name: /what gets sent/i }));

    expect(screen.getByLabelText('What gets sent', { selector: 'pre' }).textContent).toBe(
      'Board columns jump\n\nVersion: 0.12.0',
    );
    expect(screen.getByText('Never sent: prompts and replies.')).toBeDefined();
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
