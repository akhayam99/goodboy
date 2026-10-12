import { createRef, useMemo, useState } from 'react';
import type { FileDiff } from '@goodboy/types';
import { ChangeTree } from '../../../../../features/diff/components/ChangeTree';
import { buildChangeTree } from '../../../../../features/diff/lib/changeTree';
import { NO_KINDS } from '../../../../../features/diff/lib/commentKinds';

type FileParams = {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
};

const fileAt = ({ path, additions, deletions }: FileParams): FileDiff => ({
  path,
  status: 'modified',
  additions,
  deletions,
  binary: false,
  hunks: [],
});

const FILES = [
  fileAt({ path: 'src/ledger/export/csv/writer.ts', additions: 42, deletions: 6 }),
  fileAt({ path: 'src/ledger/export/csv/header.ts', additions: 8, deletions: 2 }),
  fileAt({ path: 'src/ledger/export/page.tsx', additions: 17, deletions: 3 }),
  fileAt({ path: 'src/ledger/totals.ts', additions: 5, deletions: 5 }),
  fileAt({ path: 'src/notify/relay/queue/retry.ts', additions: 21, deletions: 9 }),
  fileAt({ path: 'package.json', additions: 1, deletions: 1 }),
];

const NO_FILTER = {
  query: '',
  onQuery: () => undefined,
  unviewedOnly: false,
  onUnviewedOnly: () => undefined,
  commentedOnly: false,
  onCommentedOnly: () => undefined,
  group: 'folders' as const,
  onGroup: () => undefined,
  isFiltering: false,
  onClear: () => undefined,
};

const FILTER_REF = createRef<HTMLInputElement>();

const DiffTreeScene = () => {
  const [activePath, setActivePath] = useState<string | null>('src/ledger/export/csv/writer.ts');
  const tree = useMemo(() => buildChangeTree({ files: FILES }), []);
  return (
    <div className="h-screen w-80 bg-background p-3">
      <ChangeTree
        tree={tree}
        allFiles={FILES}
        filter={NO_FILTER}
        filterRef={FILTER_REF}
        activePath={activePath}
        collapsed={new Set()}
        onToggleFolder={() => undefined}
        onPick={setActivePath}
        stateOf={() => 'none'}
        commentCountOf={() => 0}
        kindsOf={() => NO_KINDS}
        isReadOnly={false}
        onToggleViewed={() => undefined}
        onNextUnviewed={() => undefined}
        onLeave={() => undefined}
      />
    </div>
  );
};

export const U25_DIFF_TREE_SCENES = { 'diff-tree-indent': DiffTreeScene };
