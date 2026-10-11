import { useCallback, useEffect, useRef } from 'react';
import type { DiffHunkLine, FileDiff } from '@goodboy/types';
import { DiffView } from '../../../../../features/diff/components/DiffView';
import type { FileSidesLoader } from '../../../../../features/diff/hooks/useFileSides';
import { worktreeFileSides } from '../../../../../features/worktree/worktree';
import { useFakeTauri } from '../brand/fakeTauri';

const FILE: FileDiff = {
  path: 'src/ledger-core.ts',
  status: 'modified',
  additions: 2,
  deletions: 2,
  binary: false,
  hunks: [10, 60].map((start) => ({
    header: '',
    oldStart: start,
    newStart: start,
    oldLines: 11,
    newLines: 11,
    lines: Array.from({ length: 11 }, (_, index) => index).flatMap<DiffHunkLine>((index) =>
      index === 5
        ? [
            {
              kind: 'del' as const,
              oldLine: start + index,
              newLine: null,
              text: `export const ledger${start + index} = 0;`,
            },
            {
              kind: 'add' as const,
              oldLine: null,
              newLine: start + index,
              text: `export const ledger${start + index} = ${start + index};`,
            },
          ]
        : [
            {
              kind: 'context' as const,
              oldLine: start + index,
              newLine: start + index,
              text: `export const ledger${start + index} = ${start + index};`,
            },
          ],
    ),
  })),
};
const TEXT =
  Array.from({ length: 100 }, (_, index) => `export const ledger${index + 1} = ${index + 1};`).join(
    '\n',
  ) + '\n';
const SIDES = { old: TEXT, new: TEXT, too_large: false };
const TOO_LARGE = { old: null, new: null, too_large: true };
const HANDLERS = { worktree_file_sides: () => SIDES };
const LARGE_HANDLERS = { worktree_file_sides: () => TOO_LARGE };
const loadFileSides: FileSidesLoader = (file) =>
  worktreeFileSides({ worktreePath: '/mock/payments-api', path: file.path });

type Props = { readonly state: 'gaps' | 'expanded' | 'toolarge' };

export const DiffContextScene = ({ state }: Props) => {
  useFakeTauri({ handlers: state === 'toolarge' ? LARGE_HANDLERS : HANDLERS, holdMs: 60_000 });
  const expansion = useRef<(() => Promise<void>) | null>(null);
  const register = useCallback((_path: string, expand: (() => Promise<void>) | null) => {
    expansion.current = expand;
  }, []);
  useEffect(() => {
    if (state === 'gaps') {
      return;
    }
    void expansion.current?.();
  }, [state]);
  return (
    <main className="flex min-h-0 min-w-0 flex-col gap-3 bg-background p-6 text-foreground">
      <h1 className="text-title">Payments API changes</h1>
      <DiffView
        files={[FILE]}
        presentation="inline"
        loadFileSides={loadFileSides}
        registerExpandAll={register}
        fileActions={{ onOpenInEditor: () => undefined }}
      />
    </main>
  );
};
