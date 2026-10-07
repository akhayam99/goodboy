import { useState } from 'react';
import { GitFork } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  AnchoredPopover,
  Button,
  Input,
  SegmentedTabs,
  Tooltip,
  cn,
  useDropdown,
} from '@goodboy/ui';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectProjectById } from '../../../../../store/slices/projects/selectProjectById';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ExistingBranchField } from '../../../../worktree/ExistingBranchField';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly presentation?: 'icon' | 'button';
  readonly triggerClassName?: string;
};

export const NewBranchMountAction = ({
  sessionId,
  projectId,
  projectName,
  presentation = 'button',
  triggerClassName,
}: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 240 });
  const forkMount = useAppStore((state) => state.forkMount);
  const reportError = useAppStore((state) => state.reportError);
  const project = useAppStore((state) => selectProjectById(state, projectId));
  const mountedBranches = useAppStore(
    useShallow((state) => (state.sessionProjectMounts?.[sessionId] ?? []).map((m) => m.branch)),
  );
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [branch, setBranch] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const create = async () => {
    setIsBusy(true);
    try {
      const trimmed = branch.trim();
      await forkMount({
        sessionId,
        projectId,
        ...(trimmed === '' ? {} : { branch: trimmed }),
        ...(mode === 'existing' ? { adoptExistingBranch: true } : {}),
      });
      setBranch('');
      dropdown.close();
    } catch (error) {
      void reportError({
        title: `Couldn't create a new worktree of ${projectName}`,
        error,
        sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`New worktree in ${projectName}`}
      trigger={
        <Tooltip content={`Add another worktree of ${projectName} on its own branch`}>
          <button
            type="button"
            aria-label={`New worktree in ${projectName}`}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={() => dropdown.toggle()}
            className={cn(
              triggerClassName ??
                'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-chip text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            )}
          >
            <GitFork size={ICON_SIZE.row} aria-hidden />
            {presentation === 'button' ? (
              <span className="@max-md:hidden">New worktree</span>
            ) : null}
          </button>
        </Tooltip>
      }
    >
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-label font-medium text-foreground">
            {`New worktree in ${projectName}`}
          </span>
          <span className="text-meta text-muted-foreground">
            It gets its own branch. The worktrees already here keep their branches and pull
            requests.
          </span>
        </div>
        <SegmentedTabs
          ariaLabel="Branch source"
          options={[
            { value: 'new', label: 'New branch', disabled: isBusy },
            { value: 'existing', label: 'Existing branch', disabled: isBusy },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setBranch('');
          }}
          size="sm"
        />
        {mode === 'existing' && project !== null ? (
          <ExistingBranchField
            repoRoot={project.rootPath}
            workspaceId={project.workspaceId}
            projectId={projectId}
            value={branch}
            onChange={setBranch}
            disabled={isBusy}
            excludeNames={mountedBranches}
          />
        ) : (
          <Input
            value={branch}
            autoFocus
            disabled={isBusy}
            aria-label="Branch name"
            placeholder="Leave empty to name it automatically"
            onChange={(event) => setBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }
              event.preventDefault();
              void create();
            }}
            className="h-8 w-full text-label"
          />
        )}
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => dropdown.close()}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isBusy || (mode === 'existing' && branch.trim() === '')}
            onClick={() => void create()}
          >
            {isBusy ? 'Creating…' : 'Create worktree'}
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
};
