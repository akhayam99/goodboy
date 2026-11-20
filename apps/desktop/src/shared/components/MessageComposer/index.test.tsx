// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setShortcutOverrides } from '../../keyboard/overrides/setShortcutOverrides';
import { MessageComposer } from '.';

type HarnessParams = {
  readonly isStreaming: boolean;
  readonly onStop: () => void;
};

const renderComposer = ({ isStreaming, onStop }: HarnessParams) =>
  render(
    <MessageComposer
      label="Ask a question"
      placeholder="Ask a question"
      text=""
      onTextChange={() => undefined}
      onRestoreText={() => undefined}
      isStreaming={isStreaming}
      isStopping={false}
      isImagesOn={false}
      minRows={1}
      maxRows={4}
      model={null}
      onSend={async () => true}
      onStop={onStop}
    />,
  );

type KeyParams = {
  readonly code: string;
  readonly key: string;
  readonly isAltDown?: boolean;
};

const ESCAPE: KeyParams = { code: 'Escape', key: 'Escape' };

const press = ({ code, key, isAltDown = false }: KeyParams): boolean => {
  const field = screen.getByRole('textbox', { name: 'Ask a question' });
  let isPrevented = false;
  act(() => {
    isPrevented = !fireEvent.keyDown(field, { code, key, altKey: isAltDown });
  });
  return isPrevented;
};

beforeEach(() => {
  vi.useFakeTimers();
  setShortcutOverrides({ overrides: {} });
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  setShortcutOverrides({ overrides: {} });
  vi.useRealTimers();
});

describe('Esc in the Chat and Ask composer', () => {
  it('arms on the first Esc and stops the reply on the second', () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });

    expect(press(ESCAPE)).toBe(true);
    expect(onStop).not.toHaveBeenCalled();
    screen.getByText('Esc again to stop');

    expect(press(ESCAPE)).toBe(true);
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByText('Esc again to stop')).toBeNull();
  });

  it('forgets the first Esc after three seconds', () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });

    press(ESCAPE);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    press(ESCAPE);

    expect(onStop).not.toHaveBeenCalled();
    screen.getByText('Esc again to stop');
  });

  it('leaves Esc to the panel when no reply streams', () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: false, onStop });

    expect(press(ESCAPE)).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Send' });
  });

  it('leaves Esc to an open menu above the field', () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);

    expect(press(ESCAPE)).toBe(false);
    expect(press(ESCAPE)).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('leaves Esc to a hover card above the field', () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });
    const card = document.createElement('div');
    card.setAttribute('data-hover-surface', '');
    document.body.append(card);

    expect(press(ESCAPE)).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('follows an override of the stop key, the way the session composer does', () => {
    const onStop = vi.fn();
    setShortcutOverrides({ overrides: { 'agent.stop': 'alt+Period' } });
    renderComposer({ isStreaming: true, onStop });

    expect(press(ESCAPE)).toBe(false);
    press({ code: 'Period', key: '.', isAltDown: true });
    press({ code: 'Period', key: '.', isAltDown: true });

    expect(onStop).toHaveBeenCalledOnce();
  });
});
