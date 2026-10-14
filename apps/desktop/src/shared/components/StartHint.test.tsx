// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEscapeLayer } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { START_HINT_LIMITS } from '../../store/slices/startHints/startHintLimits';
import { StartHint } from './StartHint';

const SESSION = brandedId<SessionId>({ value: 'session-hint' });
const SCOPE = 'fix-comments';
const LABEL = 'Hint for the agent';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type PageProps = {
  readonly onClose: () => void;
  readonly isDisabled?: boolean;
};

const Page = ({ onClose, isDisabled = false }: PageProps) => {
  useEscapeLayer(onClose, true);
  return (
    <StartHint
      sessionId={SESSION}
      scope={SCOPE}
      label={LABEL}
      placeholder="What to weigh or leave alone. Optional."
      isDisabled={isDisabled}
      disabledNote="A Debugger is analyzing this check."
    />
  );
};

type PopoverProps = {
  readonly onClose: () => void;
};

const Popover = ({ onClose }: PopoverProps) => {
  useEscapeLayer(onClose, true);
  return <div role="dialog" aria-label="Model" />;
};

const press = (key: string): void => {
  fireEvent.keyDown(window, { key, code: key });
};

const draft = (): string | undefined => useAppStore.getState().startHints[SESSION]?.[SCOPE]?.text;

describe('the start hint line', () => {
  it('is one closed line with no field until it is clicked', () => {
    render(<Page onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add a hint' })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('opens a two row field with the label, the placeholder and no clear button while empty', () => {
    render(<Page onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));

    const field = screen.getByRole('textbox', { name: LABEL });
    expect(field.getAttribute('placeholder')).toBe('What to weigh or leave alone. Optional.');
    expect(field.getAttribute('maxlength')).toBe(String(START_HINT_LIMITS.max));
    expect(screen.queryByRole('button', { name: 'Clear hint' })).toBeNull();
  });

  it('writes to the draft and clears it with the small x', () => {
    render(<Page onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));

    fireEvent.change(screen.getByRole('textbox', { name: LABEL }), {
      target: { value: 'Keep it.' },
    });
    expect(draft()).toBe('Keep it.');
    fireEvent.click(screen.getByRole('button', { name: 'Clear hint' }));

    expect(draft()).toBeUndefined();
    expect(screen.getByRole('textbox', { name: LABEL })).toHaveProperty('value', '');
  });

  it('shows the counter only near the cap', () => {
    render(<Page onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    const field = screen.getByRole('textbox', { name: LABEL });

    fireEvent.change(field, { target: { value: 'a'.repeat(1799) } });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(field, { target: { value: 'a'.repeat(1800) } });

    expect(screen.getByRole('status').textContent).toBe('1800 of 2000');
  });

  it('closes in order on Escape: the popover, then the field keeping its text, then the page', () => {
    const onClose = vi.fn();
    const onPopoverClose = vi.fn();
    const view = render(<Page onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: LABEL }), {
      target: { value: 'Keep it.' },
    });
    view.rerender(
      <>
        <Page onClose={onClose} />
        <Popover onClose={onPopoverClose} />
      </>,
    );

    press('Escape');
    expect(onPopoverClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: LABEL })).toBeDefined();
    view.rerender(<Page onClose={onClose} />);

    press('Escape');
    expect(screen.queryByRole('textbox', { name: LABEL })).toBeNull();
    expect(draft()).toBe('Keep it.');
    expect(onClose).not.toHaveBeenCalled();

    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens filled when a draft already exists and offers Edit hint after Escape', () => {
    useAppStore.getState().setStartHint({ sessionId: SESSION, scope: SCOPE, text: 'Keep it.' });
    render(<Page onClose={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveProperty('value', 'Keep it.');
    act(() => press('Escape'));

    expect(screen.getByRole('button', { name: 'Edit hint' })).toBeDefined();
  });

  it('disables the field and says why while the start is blocked', () => {
    useAppStore.getState().setStartHint({ sessionId: SESSION, scope: SCOPE, text: 'Keep it.' });
    render(<Page onClose={vi.fn()} isDisabled />);

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveProperty('disabled', true);
    expect(screen.getByText('A Debugger is analyzing this check.')).toBeDefined();
  });
});
