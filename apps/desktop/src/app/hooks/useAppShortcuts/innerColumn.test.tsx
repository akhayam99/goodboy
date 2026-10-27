// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { innerColumnStore, useInnerColumn } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../store/storyHarness';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { useAppShortcuts } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
});

afterEach(cleanup);

type ProbeProps = {
  readonly id: string;
  readonly toggle: () => void;
  readonly isActive: boolean;
};

const Probe = ({ id, toggle, isActive }: ProbeProps) => {
  useInnerColumn({ id, label: `Fold ${id}`, toggle, isActive });
  return null;
};

type Props = {
  readonly toggleSidebar: () => void;
  readonly columns: ReadonlyArray<ProbeProps>;
};

const Harness = ({ toggleSidebar, columns }: Props) => {
  useAppShortcuts({
    armDeleteConfirm: () => undefined,
    openPalette: () => undefined,
    openSettings: () => undefined,
    openTerminalStudio: () => undefined,
    openNewChat: () => undefined,
    openShortcutHelp: () => undefined,
    toggleSidebar,
  });
  return (
    <>
      {columns.map((column) => (
        <Probe key={column.id} {...column} />
      ))}
    </>
  );
};

describe('the inner column key', () => {
  it('folds the inner column of the page on top, and leaves the sidebar alone', () => {
    const toggleSidebar = vi.fn();
    const session = vi.fn();
    const chat = vi.fn();
    render(
      <Harness
        toggleSidebar={toggleSidebar}
        columns={[
          { id: 'session-rail', toggle: session, isActive: true },
          { id: 'chat', toggle: chat, isActive: true },
        ]}
      />,
    );

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(session).not.toHaveBeenCalled();
    expect(toggleSidebar).not.toHaveBeenCalled();
  });

  it('skips a column whose page is not shown', () => {
    const session = vi.fn();
    render(
      <Harness
        toggleSidebar={() => undefined}
        columns={[{ id: 'session-rail', toggle: session, isActive: false }]}
      />,
    );

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(session).not.toHaveBeenCalled();
  });

  it('does nothing on a page with no inner column', () => {
    const toggleSidebar = vi.fn();
    render(<Harness toggleSidebar={toggleSidebar} columns={[]} />);

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(innerColumnStore.current()).toBeNull();
    expect(toggleSidebar).not.toHaveBeenCalled();
  });
});
