// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ listen: vi.fn(async () => () => undefined) }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ReportSheetHost } from '../../../../../features/bug-report/components/ReportSheetHost';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_REPORT_SCENES } from './r4-report-bug';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (): Promise<Element> => {
  const Scene = U25_R4_REPORT_SCENES['r4-report-bug'];
  const { container } = render(
    <ToastProvider>
      <Scene />
      <ReportSheetHost />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the round 4 report scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES['r4-report-bug']).toBe(U25_R4_REPORT_SCENES['r4-report-bug']);
  });

  it('r4-report-bug opens the report beside the sidebar bug icon', async () => {
    await mount();

    const sheet = screen.getByRole('dialog', { name: 'Report a bug' });
    expect(sheet.closest('[data-report-placement]')?.getAttribute('data-report-placement')).toBe(
      'beside-trigger',
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('r4-report-bug has no accessibility violation', async () => {
    const container = await mount();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
