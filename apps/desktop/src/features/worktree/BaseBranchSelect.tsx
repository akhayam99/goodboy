import { useEffect, useState } from 'react';
import { cn, Listbox } from '@goodboy/ui';
import { listBranchNames } from './worktree';

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

  return (
    <Listbox
      ariaLabel="Base branch"
      size="sm"
      noun="branch"
      searchable
      searchLabel="Search branches"
      searchPlaceholder="Search or enter a branch"
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      options={branches.map((branch) => ({ value: branch, label: branch, isCode: true }))}
      onChange={commit}
      onOpenChange={setIsOpen}
      create={{ label: (query) => `Use ${query}`, onCreate: commit }}
      status={STATUS_LABEL[loadState]}
      valueLabel={
        <span className={cn('truncate text-code', value === null && 'text-faint-foreground')}>
          {value ?? placeholder}
        </span>
      }
      footer={
        value === null
          ? undefined
          : ({ close }) => (
              <button
                type="button"
                onClick={() => {
                  commit('');
                  close();
                }}
                className="flex h-8 items-center rounded-sm px-2 text-left text-label text-muted-foreground hover:bg-hover hover:text-foreground"
              >
                Use default
              </button>
            )
      }
    />
  );
};
