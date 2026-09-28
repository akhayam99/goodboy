// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../platform', () => ({ currentPlatform: () => 'darwin' }));

import { terminalFindKey } from './terminalFindKey';
import { TerminalFindBar, type TerminalFindResults } from './TerminalFindBar';

type KeyParams = {
  readonly code: string;
  readonly shiftKey?: boolean;
};

const key = ({ code, shiftKey = false }: KeyParams): KeyboardEvent =>
  new KeyboardEvent('keydown', { code, metaKey: true, shiftKey });

type ControllerParams = {
  readonly results: TerminalFindResults;
};

const makeController = ({ results }: ControllerParams) => {
  const listeners: Array<(value: TerminalFindResults) => void> = [];
  return {
    findNext: vi.fn((_term: string) => listeners.forEach((listener) => listener(results))),
    findPrevious: vi.fn((_term: string) => undefined),
    clear: vi.fn(),
    onResults: (listener: (value: TerminalFindResults) => void) => {
      listeners.push(listener);
      return () => undefined;
    },
  };
};

afterEach(cleanup);

describe('terminal find', () => {
  it('claims Cmd+F always, and Cmd+G and Shift+Cmd+G only while its bar is open', () => {
    expect(terminalFindKey({ event: key({ code: 'KeyF' }), isOpen: false })).toBe('open');
    expect(terminalFindKey({ event: key({ code: 'KeyG' }), isOpen: false })).toBeNull();
    expect(terminalFindKey({ event: key({ code: 'KeyG' }), isOpen: true })).toBe('next');
    expect(terminalFindKey({ event: key({ code: 'KeyG', shiftKey: true }), isOpen: true })).toBe(
      'previous',
    );
    expect(terminalFindKey({ event: key({ code: 'KeyK' }), isOpen: true })).toBeNull();
  });

  it('finds in the scrollback as you type and walks with Enter and Shift+Enter', () => {
    const controller = makeController({ results: { index: 1, count: 4 } });
    const onClose = vi.fn();
    render(<TerminalFindBar controller={controller} step={1} onClose={onClose} />);
    const field = screen.getByRole('textbox', { name: 'Find in terminal' });
    fireEvent.change(field, { target: { value: 'error' } });
    expect(controller.findNext).toHaveBeenLastCalledWith('error');
    expect(screen.getByRole('status').textContent).toBe('2 of 4');
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(controller.findPrevious).toHaveBeenCalledWith('error');
    fireEvent.keyDown(field, { key: 'g', code: 'KeyG', metaKey: true });
    expect(controller.findNext).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the marks when the field empties', () => {
    const controller = makeController({ results: { index: -1, count: 0 } });
    render(<TerminalFindBar controller={controller} step={1} onClose={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Find in terminal' });
    fireEvent.change(field, { target: { value: 'x' } });
    expect(screen.getByRole('status').textContent).toBe('No match');
    fireEvent.change(field, { target: { value: '' } });
    expect(controller.clear).toHaveBeenCalled();
  });
});
