// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ModelPickerScene, ModelPickerTriggersScene } from './ModelPickerScenes';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const openPickers = () => {
  act(() => {
    vi.advanceTimersByTime(300);
  });
};

describe('ModelPickerScene', () => {
  it('opens the Cursor popover on a family chip, its version row and its variant row', () => {
    vi.useFakeTimers();
    render(<ModelPickerScene />);
    openPickers();

    const cursor = within(screen.getByRole('dialog', { name: 'Cursor routing' }));
    expect(
      within(cursor.getByRole('group', { name: 'Model' }))
        .getByRole('button', { name: 'Gemini' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      within(cursor.getByRole('group', { name: 'Version' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['3', '3.1', '3.5', '3.6', '3.7', '3.8']);
    expect(
      within(cursor.getByRole('group', { name: 'Version' }))
        .getByRole('button', { name: '3.8' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    const variants = within(cursor.getByRole('group', { name: 'Variant' })).getAllByRole('button');
    expect(variants.map((button) => button.textContent)).toEqual(['Flash']);
    expect(variants[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the Codex popover on its version and variant rows', () => {
    vi.useFakeTimers();
    render(<ModelPickerScene />);
    openPickers();

    const codex = within(screen.getByRole('dialog', { name: 'Codex routing' }));
    expect(
      within(codex.getByRole('group', { name: 'Version' }))
        .getByRole('button', { name: '5.6' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      within(codex.getByRole('group', { name: 'Variant' }))
        .getByRole('button', { name: 'Sol' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('lines up one closed trigger per grammar the picker can produce', () => {
    render(<ModelPickerTriggersScene />);
    expect(
      screen
        .getAllByRole('button', { name: / routing: / })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'cursor composer routing: Cursor · Composer · 2.5 · Fast',
      'codex sol routing: Codex · GPT · 5.6 · Sol · High',
      'codex astra routing: Codex · GPT · 6 · Astra · High',
      'cursor kimi routing: Cursor · Kimi · K3 · High',
      'claude opus routing: Claude · Opus · 5.5 · High',
      'cursor codex routing: Cursor · GPT · 5.3 · Codex',
      'cursor auto routing: Cursor · Auto',
    ]);
  });
});
