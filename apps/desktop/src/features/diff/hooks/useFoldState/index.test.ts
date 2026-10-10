// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { FileDiff, MountId, SessionId } from '@goodboy/types';
import { useFoldState } from '.';
import { MAX_FOLD_ENTRIES, foldKeyOf } from './foldStorage';

const SESSION = 'session-ledger' as SessionId;
const MOUNT = 'mount-ledger-core' as MountId;

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

const FILES = [
  fileAt('src/ledger/export/page.tsx'),
  fileAt('src/ledger/ledger.ts'),
  fileAt('src/webhooks/apply.ts'),
  fileAt('pnpm-lock.yaml'),
];

const KEY = foldKeyOf({ sessionId: SESSION, mountId: MOUNT });

type MountParams = {
  readonly files?: ReadonlyArray<FileDiff>;
  readonly sessionId?: SessionId;
  readonly mountId?: MountId | null;
};

const mount = ({ files = FILES, sessionId = SESSION, mountId = MOUNT }: MountParams = {}) =>
  renderHook((props: MountParams) => useFoldState({ sessionId, mountId, files, ...props }), {
    initialProps: {},
  });

const stored = (): unknown => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe('useFoldState', () => {
  it('starts with only the Generated row closed', () => {
    const { result } = mount();

    expect([...result.current.collapsed]).toEqual(['group:generated']);
  });

  it('remembers two closed folders after the view unmounts and mounts again', () => {
    const first = mount();
    act(() => first.result.current.toggleFolder('dir:src/ledger/export'));
    act(() => first.result.current.toggleFolder('dir:src/webhooks'));
    first.unmount();

    const second = mount();

    expect(second.result.current.collapsed.has('dir:src/ledger/export')).toBe(true);
    expect(second.result.current.collapsed.has('dir:src/webhooks')).toBe(true);
    expect(second.result.current.collapsed.has('dir:src/ledger')).toBe(false);
  });

  it('keeps the closed folders when a new file arrives', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggleFolder('dir:src/webhooks'));

    rerender({ files: [...FILES, fileAt('src/ledger/new.ts'), fileAt('docs/ledger.md')] });

    expect(result.current.collapsed.has('dir:src/webhooks')).toBe(true);
  });

  it('keeps what the reader opened when a different set of files arrives', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggleFolder('group:generated'));
    expect(result.current.collapsed.has('group:generated')).toBe(false);

    rerender({ files: [...FILES, fileAt('yarn.lock')] });

    expect(result.current.collapsed.has('group:generated')).toBe(false);
  });

  it('stores only the deviation from the default', () => {
    const { result } = mount();

    act(() => result.current.toggleFolder('dir:src/webhooks'));
    expect(stored()).toEqual({ closed: ['dir:src/webhooks'], opened: [] });

    act(() => result.current.toggleFolder('dir:src/webhooks'));
    expect(stored()).toEqual({ closed: [], opened: [] });

    act(() => result.current.toggleFolder('group:generated'));
    expect(stored()).toEqual({ closed: [], opened: ['group:generated'] });
  });

  it('opens several folders in one write and ignores the ones already open', () => {
    const { result } = mount();
    act(() => result.current.toggleFolder('dir:src/ledger/export'));
    act(() => result.current.toggleFolder('dir:src/ledger'));

    act(() => result.current.openFolders(['dir:src/ledger/export', 'dir:src/ledger', 'dir:src']));

    expect([...result.current.collapsed]).toEqual(['group:generated']);
    expect(stored()).toEqual({ closed: [], opened: [] });
  });

  it('ignores stored ids that are not in the tree and prunes them on the next write', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ closed: ['dir:gone/folder', 'dir:src/webhooks'], opened: ['dir:old'] }),
    );
    const { result } = mount();

    expect([...result.current.collapsed].sort()).toEqual(['dir:src/webhooks', 'group:generated']);

    act(() => result.current.toggleFolder('dir:src/ledger'));

    expect(stored()).toEqual({ closed: ['dir:src/webhooks', 'dir:src/ledger'], opened: [] });
  });

  it('brings a folder back when its files return', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggleFolder('dir:src/webhooks'));

    rerender({ files: [fileAt('src/ledger/ledger.ts'), fileAt('src/ledger/other.ts')] });
    expect(result.current.collapsed.has('dir:src/webhooks')).toBe(false);

    rerender({ files: FILES });
    expect(result.current.collapsed.has('dir:src/webhooks')).toBe(true);
  });

  it('keeps one set of folds per session and per mount', () => {
    const first = mount();
    act(() => first.result.current.toggleFolder('dir:src/webhooks'));

    const otherMount = mount({ mountId: 'mount-notify-relay' as MountId });
    const otherSession = mount({ sessionId: 'session-notify' as SessionId });
    const noMount = mount({ mountId: null });

    expect(otherMount.result.current.collapsed.has('dir:src/webhooks')).toBe(false);
    expect(otherSession.result.current.collapsed.has('dir:src/webhooks')).toBe(false);
    expect(noMount.result.current.collapsed.has('dir:src/webhooks')).toBe(false);
  });

  it('follows the key when the session changes under the same hook', () => {
    const { result, rerender } = mount();
    act(() => result.current.toggleFolder('dir:src/webhooks'));

    rerender({ sessionId: 'session-notify' as SessionId });
    expect(result.current.collapsed.has('dir:src/webhooks')).toBe(false);

    rerender({ sessionId: SESSION });
    expect(result.current.collapsed.has('dir:src/webhooks')).toBe(true);
  });

  it('caps what it stores at 500 entries and keeps the latest', () => {
    const files = Array.from({ length: 520 }, (_, index) => fileAt(`pkg${index}/a/file.ts`));
    const { result } = mount({ files });

    for (let index = 0; index < 520; index += 1) {
      act(() => result.current.toggleFolder(`dir:pkg${index}/a`));
    }

    const saved = stored() as { readonly closed: ReadonlyArray<string> };
    expect(saved.closed).toHaveLength(MAX_FOLD_ENTRIES);
    expect(saved.closed.at(-1)).toBe('dir:pkg519/a');
    expect(saved.closed).not.toContain('dir:pkg0/a');
  });

  it('starts from the default when the stored value is damaged', () => {
    for (const raw of ['not json', '{"closed":3}', '[]', 'null', '{"closed":[1],"opened":[]}']) {
      localStorage.setItem(KEY, raw);
      const { result, unmount } = mount();

      expect([...result.current.collapsed]).toEqual(['group:generated']);
      unmount();
    }
  });

  it('folds and unfolds for the session when the storage throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      const { result } = mount();

      act(() => result.current.toggleFolder('dir:src/webhooks'));
      expect(result.current.collapsed.has('dir:src/webhooks')).toBe(true);

      act(() => result.current.toggleFolder('dir:src/webhooks'));
      expect(result.current.collapsed.has('dir:src/webhooks')).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('closes a kind group by its own id', () => {
    const { result } = mount();

    act(() => result.current.toggleFolder('group:source'));

    expect(result.current.collapsed.has('group:source')).toBe(true);
  });
});
