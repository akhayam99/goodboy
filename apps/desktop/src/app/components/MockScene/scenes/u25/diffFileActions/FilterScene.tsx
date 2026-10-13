import { createRef, useEffect, useMemo, useState } from 'react';
import { ChangeTree } from '../../../../../../features/diff/components/ChangeTree';
import { buildChangeTree } from '../../../../../../features/diff/lib/changeTree';
import { NO_KINDS } from '../../../../../../features/diff/lib/commentKinds';
import { FILE } from './seed';

const FILTER_FILES = [
  { ...FILE, path: 'src/ledger/export/route.ts' },
  { ...FILE, path: 'src/ledger/export/router.ts' },
  { ...FILE, path: 'src/notify/relay/route.ts' },
];

const NO_FILTER = {
  query: 'rout',
  onQuery: () => undefined,
  unviewedOnly: false,
  onUnviewedOnly: () => undefined,
  commentedOnly: false,
  onCommentedOnly: () => undefined,
  group: 'folders' as const,
  onGroup: () => undefined,
  isFiltering: true,
  onClear: () => undefined,
};

type Props = Record<never, never>;

export const FilterScene = ({}: Props) => {
  const filterRef = useMemo(() => createRef<HTMLInputElement>(), []);
  const [activePath, setActivePath] = useState<string | null>(FILTER_FILES[0]?.path ?? null);
  const tree = useMemo(() => buildChangeTree({ files: FILTER_FILES }), []);
  useEffect(() => {
    filterRef.current?.focus();
  }, [filterRef]);
  return (
    <div className="h-80 w-80 bg-background p-3">
      <ChangeTree
        tree={tree}
        allFiles={FILTER_FILES}
        filter={{ ...NO_FILTER, query: 'rout' }}
        filterRef={filterRef}
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
