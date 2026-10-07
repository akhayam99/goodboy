// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { SESSION } from '../../../../../app/components/MockScene/scenes/activityRunSeed';
import { AskComposer } from './AskComposer';

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
  await importStore();
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
