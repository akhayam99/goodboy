import { useEffect, useState } from 'react';
import { cn, Listbox } from '@goodboy/ui';
import { BRANCH_PICKER_MAX_WIDTH, branchPickerOption } from './branchPicker';
import { listBranchNames, repoDefaultBaseBranch } from './worktree';

type Props = {
  readonly repoPath: string;
  readonly value: string | null;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly onCommit: (next: string | null) => void | Promise<void>;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

const STATUS_LABEL: Record<LoadState, string | undefined> = {
  idle: undefined,
  loading: 'Loading branches',
  ready: undefined,
  failed: 'Could not load branches',
};

const AUTO_VALUE = '';

export const BaseBranchSelect = ({
  repoPath,
  value,
  placeholder = 'main',
  disabled = false,
  onCommit,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    repoDefaultBaseBranch({ repoPath })
      .then((next) => {
        if (!isCancelled) {
          setDetected(next);
        }
      })
      .catch(() => undefined);
    return () => {
      isCancelled = true;
    };
  }, [repoPath]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let isCancelled = false;
    setLoadState('loading');
    listBranchNames({ repoPath })
      .then((nextBranches) => {
        if (isCancelled) {
          return;
        }
        setBranches(nextBranches);
        setLoadState('ready');
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadState('failed');
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, repoPath]);

  const commit = (candidate: string) => {
    const trimmed = candidate.trim();
    void onCommit(trimmed === '' ? null : trimmed);
  };

  const autoLabel = detected === null ? 'Auto' : `Auto · ${detected}`;
  const autoDescription = detected === null ? undefined : `Detected from origin/HEAD: ${detected}`;

  return (
    <Listbox
      ariaLabel="Base branch"
      size="sm"
      noun="branch"
      maxPopupWidth={BRANCH_PICKER_MAX_WIDTH}
      searchable
      searchLabel="Search branches"
      searchPlaceholder="Search or enter a branch"
      placeholder={placeholder}
      disabled={disabled}
      value={value ?? AUTO_VALUE}
      options={[
        { value: AUTO_VALUE, label: 'Auto', description: autoDescription },
        ...branches.map((branch) => branchPickerOption({ name: branch })),
      ]}
      onChange={commit}
      onOpenChange={setIsOpen}
      create={{ label: (query) => `Use ${query}`, onCreate: commit }}
      status={STATUS_LABEL[loadState]}
      valueLabel={
        <span className={cn('truncate text-code', value === null && 'text-faint-foreground')}>
          {value ?? autoLabel}
        </span>
      }
    />
  );
};
