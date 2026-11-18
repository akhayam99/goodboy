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
  readonly columns: ReadonlyArray<ProbeProps>;
};

const Harness = ({ columns }: Props) => {
  useAppShortcuts({
    armDeleteConfirm: () => undefined,
    openPalette: () => undefined,
    openSettings: () => undefined,
    openNewChat: () => undefined,
    openShortcutHelp: () => undefined,
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
  it('folds the inner column of the page on top only', () => {
    const session = vi.fn();
    const chat = vi.fn();
    render(
      <Harness
        columns={[
          { id: 'session-rail', toggle: session, isActive: true },
          { id: 'chat', toggle: chat, isActive: true },
        ]}
      />,
    );

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(session).not.toHaveBeenCalled();
  });

  it('skips a column whose page is not shown', () => {
    const session = vi.fn();
    render(<Harness columns={[{ id: 'session-rail', toggle: session, isActive: false }]} />);

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(session).not.toHaveBeenCalled();
  });

  it('does nothing on a page with no inner column', () => {
    render(<Harness columns={[]} />);

    pressShortcut({ id: 'innerColumn.toggle' });

    expect(innerColumnStore.current()).toBeNull();
  });
});
