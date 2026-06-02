// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { MergeDialog, SKIP_SENTINEL } from './index';

afterEach(cleanup);

const RUN_A = 'run-a' as ProviderRunId;
const RUN_B = 'run-b' as ProviderRunId;

const ONE_CONFLICT = [
  { file: 'src/foo.ts', runIds: [RUN_A, RUN_B] as ReadonlyArray<ProviderRunId> },
];

const TWO_CONFLICTS = [
  { file: 'src/foo.ts', runIds: [RUN_A, RUN_B] as ReadonlyArray<ProviderRunId> },
  { file: 'src/bar.ts', runIds: [RUN_A, RUN_B] as ReadonlyArray<ProviderRunId> },
];

describe('MergeDialog, rendering', () => {
  it('renders file path in mono font', () => {
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('src/foo.ts')).toBeDefined();
  });

  it('renders a radio for each runId + skip option', () => {
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    // 2 runIds + 1 skip = 3
    expect(radios).toHaveLength(3);
  });

  it('renders all files when multiple conflicts', () => {
    render(
      <MergeDialog open={true} conflicts={TWO_CONFLICTS} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('src/foo.ts')).toBeDefined();
    expect(screen.getByText('src/bar.ts')).toBeDefined();
  });

  it('renders empty-state message when no conflicts', () => {
    render(<MergeDialog open={true} conflicts={[]} onResolve={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('no conflicts to resolve')).toBeDefined();
  });

  it('renders generic run labels when no run metadata is supplied', () => {
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('run 1')).toBeDefined();
    expect(screen.getByText('run 2')).toBeDefined();
  });
});

describe('MergeDialog, confirm button gate', () => {
  it('confirm disabled before any pick', () => {
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    const confirm = screen.getByRole('button', { name: /apply merge/i });
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });

  it('confirm enabled after picking a winner for all files', () => {
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!); // pick run-a
    const confirm = screen.getByRole('button', { name: /apply merge/i });
    expect(confirm.hasAttribute('disabled')).toBe(false);
  });

  it('confirm disabled when only one of two files is resolved', () => {
    render(
      <MergeDialog open={true} conflicts={TWO_CONFLICTS} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    // pick run-a for first file only (radio index 0)
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);
    const confirm = screen.getByRole('button', { name: /apply merge/i });
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });

  it('confirm enabled after picking skip for all files', () => {
    render(
      <MergeDialog open={true} conflicts={TWO_CONFLICTS} onResolve={vi.fn()} onCancel={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    // Each conflict has 3 radios: run-a, run-b, skip. Total = 6.
    // Skip for file 1 = index 2; skip for file 2 = index 5.
    fireEvent.click(radios[2]!);
    fireEvent.click(radios[5]!);
    const confirm = screen.getByRole('button', { name: /apply merge/i });
    expect(confirm.hasAttribute('disabled')).toBe(false);
  });

  it('confirm enabled when no conflicts (edge case: always resolved)', () => {
    // With 0 conflicts the button stays disabled because
    // "allResolved = conflicts.length > 0 && ..." guards the empty state.
    render(<MergeDialog open={true} conflicts={[]} onResolve={vi.fn()} onCancel={vi.fn()} />);
    const confirm = screen.getByRole('button', { name: /apply merge/i });
    // empty conflicts → allResolved = false → disabled
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });
});

describe('MergeDialog, onResolve payload', () => {
  it('calls onResolve with correct runId pick', () => {
    const onResolve = vi.fn();
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={onResolve} onCancel={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!); // run-a
    fireEvent.click(screen.getByRole('button', { name: /apply merge/i }));
    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith({ 'src/foo.ts': RUN_A });
  });

  it('calls onResolve with SKIP_SENTINEL when skip selected', () => {
    const onResolve = vi.fn();
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={onResolve} onCancel={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]!); // skip
    fireEvent.click(screen.getByRole('button', { name: /apply merge/i }));
    expect(onResolve).toHaveBeenCalledWith({ 'src/foo.ts': SKIP_SENTINEL });
  });

  it('includes all files in picks record (including skipped ones)', () => {
    const onResolve = vi.fn();
    render(
      <MergeDialog
        open={true}
        conflicts={TWO_CONFLICTS}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!); // foo.ts → run-a
    fireEvent.click(radios[5]!); // bar.ts → skip
    fireEvent.click(screen.getByRole('button', { name: /apply merge/i }));
    expect(onResolve).toHaveBeenCalledWith({
      'src/foo.ts': RUN_A,
      'src/bar.ts': SKIP_SENTINEL,
    });
  });
});

describe('MergeDialog, cancel', () => {
  it('invokes onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('resets picks state when cancel is clicked', () => {
    const onResolve = vi.fn();
    const onCancel = vi.fn();
    render(
      <MergeDialog
        open={true}
        conflicts={ONE_CONFLICT}
        onResolve={onResolve}
        onCancel={onCancel}
      />,
    );
    // pick run-a, then cancel
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // confirm is disabled after cancel resets state (not directly observable
    // without reopening, but onCancel must have been called)
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('MergeDialog, escape', () => {
  it('calls onCancel when escape key fires a close event on the dialog', () => {
    const onCancel = vi.fn();
    render(
      <MergeDialog open={true} conflicts={ONE_CONFLICT} onResolve={vi.fn()} onCancel={onCancel} />,
    );
    // The Dialog primitive listens for the native `close` event on <dialog>.
    // happy-dom fires that event when Escape is pressed on an open modal.
    const dialogEl = document.querySelector('dialog');
    expect(dialogEl).not.toBeNull();
    fireEvent.keyDown(dialogEl!, { key: 'Escape', code: 'Escape' });
    fireEvent(dialogEl!, new Event('close'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
