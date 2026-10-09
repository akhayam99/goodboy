// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { ChatId } from '@goodboy/types';
import { ToastProvider, useToast } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SESSION } from '../../../../../app/components/MockScene/scenes/activityRunSeed';
import { AskComposer } from './AskComposer';

let useAppStore: StoryStore;

const COMPOSER_HEIGHT = 112;
const LIFT_GAP = 8;

const ShowToast = () => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ kind: 'info', message: 'Run started' })}>
      Toast
    </button>
  );
};

const composer = (
  <AskComposer
    sessionId={SESSION.id}
    isStreaming={false}
    isStopping={false}
    onSend={async () => true}
    onStop={() => undefined}
  />
);

const toastBottom = (): string => {
  fireEvent.click(screen.getByRole('button', { name: 'Toast' }));
  return screen.getByRole('status').parentElement?.style.bottom ?? '';
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: window.innerHeight - COMPOSER_HEIGHT,
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Ask composer and the toast stack', () => {
  it('lifts a toast above the composer, so it never covers Send', () => {
    render(
      <ToastProvider>
        <ShowToast />
        {composer}
      </ToastProvider>,
    );

    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
    expect(toastBottom()).toBe(`${COMPOSER_HEIGHT + LIFT_GAP}px`);
  });

  it('drops the toast back once the composer is gone', () => {
    const view = render(
      <ToastProvider>
        <ShowToast />
        {composer}
      </ToastProvider>,
    );
    expect(toastBottom()).toBe(`${COMPOSER_HEIGHT + LIFT_GAP}px`);

    view.rerender(
      <ToastProvider>
        <ShowToast />
      </ToastProvider>,
    );

    expect(screen.getByRole('status').parentElement?.style.bottom).toBe('');
  });
});

type DrawerProps = { readonly onSend?: (question: string) => Promise<boolean> };

const AskDrawerHarness = ({ onSend = async () => true }: DrawerProps) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Ask
      </button>
      {isOpen ? (
        <DrawerFrame
          title="Ask"
          onClose={() => setIsOpen(false)}
          dock={
            <AskComposer
              sessionId={SESSION.id}
              isStreaming={false}
              isStopping={false}
              onSend={onSend}
              onStop={() => undefined}
            />
          }
        >
          <p>thread</p>
        </DrawerFrame>
      ) : null}
    </div>
  );
};

const field = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Ask about this session' }) as HTMLTextAreaElement;

const escape = (): void => {
  fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
};

describe('the Ask draft', () => {
  it('is still there after Esc, Esc and reopening the drawer', () => {
    render(<AskDrawerHarness />);
    expect(document.activeElement).toBe(field());

    fireEvent.change(field(), { target: { value: 'why is the build red' } });
    escape();
    expect(screen.queryByRole('region', { name: 'Ask' })).not.toBeNull();
    escape();
    expect(screen.queryByRole('region', { name: 'Ask' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(field().value).toBe('why is the build red');
    expect(document.activeElement).toBe(field());
  });

  it('is cleared by a send that lands', async () => {
    const onSend = vi.fn(async () => true);
    render(<AskDrawerHarness onSend={onSend} />);
    fireEvent.change(field(), { target: { value: 'what needs me?' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(onSend).toHaveBeenCalledWith('what needs me?');
    expect(field().value).toBe('');
    expect(useAppStore.getState().askDrafts).toEqual({});
  });

  it('comes back when the send fails', async () => {
    render(<AskDrawerHarness onSend={async () => false} />);
    fireEvent.change(field(), { target: { value: 'what needs me?' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    await waitFor(() => expect(field().value).toBe('what needs me?'));
  });

  it('keeps one draft per thread', () => {
    render(<AskDrawerHarness />);
    fireEvent.change(field(), { target: { value: 'first thread draft' } });

    act(() => {
      useAppStore.setState({ askThreadId: { [SESSION.id]: 'thread-two' as ChatId } });
    });
    expect(field().value).toBe('');
    fireEvent.change(field(), { target: { value: 'second thread draft' } });

    act(() => {
      useAppStore.setState({ askThreadId: { [SESSION.id]: null } });
    });
    expect(field().value).toBe('first thread draft');
  });
});
