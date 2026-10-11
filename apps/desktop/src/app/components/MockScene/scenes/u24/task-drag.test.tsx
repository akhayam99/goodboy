// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_TASK_DRAG_SCENES } from './task-drag';

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

const mount = async (name: string): Promise<Element> => {
  const Scene = U24_TASK_DRAG_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  vi.spyOn(document, 'elementFromPoint').mockImplementation(() =>
    document.querySelector('[data-scene-aim]'),
  );
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const ghostText = () => screen.getByTestId('task-drag-ghost').textContent;

describe('the task drag scenes', () => {
  it('registers the four scenes for the capture', () => {
    expect(Object.keys(U24_TASK_DRAG_SCENES).sort()).toEqual([
      'taskdrag-copy',
      'taskdrag-overbranch',
      'taskdrag-oversession',
      'taskdrag-refused',
    ]);
    for (const name of Object.keys(U24_TASK_DRAG_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(U24_TASK_DRAG_SCENES[name]);
    }
  });

  it('taskdrag-oversession offers the Session pill and says Move to the session', async () => {
    await mount('taskdrag-oversession');
    expect(screen.getByLabelText('Drop to put on the session').textContent).toBe('Session');
    expect(ghostText()).toContain('HBL-412');
    expect(ghostText()).toContain('Move to the session');
  });

  it('taskdrag-overbranch names the branch it would move to', async () => {
    await mount('taskdrag-overbranch');
    expect(ghostText()).toMatch(/Move to ledger-core \/ \S+/);
  });

  it('taskdrag-refused says which project the branches belong to', async () => {
    await mount('taskdrag-refused');
    expect(ghostText()).toBe(`HBL-412Only ledger-core branches`);
  });

  it('taskdrag-copy says Copy to with Alt held', async () => {
    await mount('taskdrag-copy');
    expect(ghostText()).toMatch(/Copy to ledger-core \/ \S+/);
  });

  it.each(Object.keys(U24_TASK_DRAG_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
