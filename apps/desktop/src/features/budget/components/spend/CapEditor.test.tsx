// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapEditor } from './CapEditor';

afterEach(cleanup);

type RenderParams = {
  readonly currentCapUsd?: number | null;
  readonly currentThresholdPct?: number | null;
  readonly onSave?: (params: { capUsd: number; thresholdPct: number }) => Promise<void>;
  readonly onRemove?: () => Promise<void>;
};

const renderEditor = ({
  currentCapUsd = null,
  currentThresholdPct = null,
  onSave = vi.fn(async () => undefined),
  onRemove = vi.fn(async () => undefined),
}: RenderParams = {}) =>
  render(
    <CapEditor
      label="Monthly limit"
      currentCapUsd={currentCapUsd}
      currentThresholdPct={currentThresholdPct}
      onSave={onSave}
      onRemove={onRemove}
    />,
  );

const inputOf = ({ label }: { readonly label: string }): HTMLInputElement => {
  const element = screen.getByLabelText(label);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`${label} is not an input`);
  }
  return element;
};

const saveButton = (): HTMLButtonElement => {
  const element = screen.getByRole('button', { name: 'Save limit' });
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Save limit is not a button');
  }
  return element;
};

const limitInput = () => inputOf({ label: 'Monthly limit' });
const warnInput = () => inputOf({ label: 'Warn at percent of the limit' });

describe('CapEditor, the limit', () => {
  it('preserves in-progress typing when a late budget load resolves', () => {
    const view = renderEditor();
    fireEvent.change(limitInput(), { target: { value: '12' } });

    view.rerender(
      <CapEditor
        label="Monthly limit"
        currentCapUsd={5}
        currentThresholdPct={80}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(limitInput().value).toBe('12');
  });

  it('updates an untouched draft when the current limit changes', () => {
    const view = renderEditor();

    view.rerender(
      <CapEditor
        label="Monthly limit"
        currentCapUsd={5}
        currentThresholdPct={80}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(limitInput().value).toBe('5');
  });

  it('says Save limit and keeps it off until there is something new to save', () => {
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80 });
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(limitInput(), { target: { value: '60' } });

    expect(saveButton().disabled).toBe(false);
  });

  it('starts the warning share at 80 before a limit exists', () => {
    renderEditor();

    expect(warnInput().value).toBe('80');
    expect(screen.queryByRole('button', { name: 'Remove limit' })).toBeNull();
  });

  it('saves the limit and the warning share together', async () => {
    const onSave = vi.fn(async () => undefined);
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onSave });

    fireEvent.change(limitInput(), { target: { value: '60' } });
    fireEvent.change(warnInput(), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ capUsd: 60, thresholdPct: 90 }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves a new warning share under the same limit', async () => {
    const onSave = vi.fn(async () => undefined);
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onSave });

    fireEvent.change(warnInput(), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ capUsd: 50, thresholdPct: 60 }));
  });

  it('refuses a warning share outside 1 to 100', () => {
    const onSave = vi.fn(async () => undefined);
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onSave });

    fireEvent.change(warnInput(), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(warnInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps what you typed and shows the failure inline when the save fails', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('The database is locked');
    });
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onSave });

    fireEvent.change(limitInput(), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The database is locked');
    expect(limitInput().value).toBe('75');
    expect(saveButton().disabled).toBe(false);
  });

  it('saves again after a failure and clears the error once it goes through', async () => {
    const onSave = vi
      .fn<(params: { capUsd: number; thresholdPct: number }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('The database is locked'))
      .mockResolvedValueOnce(undefined);
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onSave });
    fireEvent.change(limitInput(), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith({ capUsd: 75, thresholdPct: 80 });
  });

  it('asks before it removes a limit, then removes the one it names', async () => {
    const onRemove = vi.fn(async () => undefined);
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove limit' }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText('Remove the $50.00 limit?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });

  it('shows a failed removal inline and keeps the limit it was editing', async () => {
    const onRemove = vi.fn(async () => {
      throw new Error('The database is locked');
    });
    renderEditor({ currentCapUsd: 50, currentThresholdPct: 80, onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove limit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The database is locked');
    expect(limitInput().value).toBe('50');
  });
});
