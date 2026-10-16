import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { FilterSection } from '../SessionActivityBar/SessionFilterPopover/FilterSection';
import { RepoAttentionPill } from './RepoAttentionPill';
import { repoNeedsAttention } from './repoNeedsAttention';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
};

export const RepoStatusSection = ({ workspaceId, entries }: Props) => {
  const fetchProjectCheckouts = useAppStore((state) => state.fetchProjectCheckouts);
  const [isChecking, setIsChecking] = useState(false);
  const isQuiet =
    entries.length > 0 && entries.every(({ status }) => !repoNeedsAttention({ status }));
  if (!isQuiet) {
    return entries.length === 0 ? null : (
      <FilterSection title="Repositories">
        <div className="flex h-7 items-center px-2">
          <RepoAttentionPill entries={entries} />
        </div>
      </FilterSection>
    );
  }
  const words = entries.length === 1 ? '1 repo, up to date' : `${entries.length} repos, up to date`;

  const onCheck = async () => {
    if (isChecking) {
      return;
    }
    setIsChecking(true);
    try {
      await fetchProjectCheckouts({ workspaceId });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <FilterSection title="Repositories">
      <div className="flex h-7 items-center justify-between gap-2 px-2">
        <span className="min-w-0 truncate text-label text-muted-foreground">{words}</span>
        <Button size="xs" variant="ghost" disabled={isChecking} onClick={() => void onCheck()}>
          {isChecking ? 'Checking…' : 'Check origin'}
        </Button>
      </div>
    </FilterSection>
  );
};
