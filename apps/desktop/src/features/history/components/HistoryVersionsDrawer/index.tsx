import { useState } from 'react';
import { Button, DrawerFrame, EmptyLine, Notice } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useHistoryRunFlow } from '../CommitsHistory/useHistoryRunFlow';
import { useHistoryPlan } from '../CommitsHistory/useHistoryPlan';
import { useHistoryVersions } from '../../useHistoryVersions';
import { HistoryVersionRow } from './HistoryVersionRow';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly onClose: () => void;
};

export const HistoryVersionsDrawer = ({ sessionId, mountId, worktreePath, onClose }: Props) => {
  const plan = useHistoryPlan({ sessionId, worktreePath });
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream: plan.hasUpstream });
  const [nowMs] = useState(() => Date.now());
  const versions = useHistoryVersions({
    sessionId,
    worktreePath,
    branch: plan.mount?.branch ?? '',
    baseRef: plan.graph?.baseRef ?? null,
    headSha: plan.model.headSha,
    revision: plan.run?.updatedAt ?? 0,
  });
  const nowSubjects = plan.commits.map((commit) => commit.subject);
  const run = plan.run;
  return (
    <DrawerFrame
      title="Previous versions"
      icon={CONCEPT_ICONS.backup}
      count={versions?.length ?? 0}
      onClose={onClose}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {run !== null && run.phase === 'restored' && run.backupRef !== null && flow !== null ? (
          <Notice
            tone="info"
            placement="inline"
            title="Branch reset"
            body="The history you left is kept as a version too."
            actions={
              <Button size="sm" variant="secondary" onClick={() => flow.restoreApplied(run)}>
                Undo
              </Button>
            }
          />
        ) : null}
        {versions !== null && versions.length === 0 ? (
          <EmptyLine className="px-2 text-meta text-muted-foreground">
            No previous versions yet. Every rewrite saves one here for 30 days.
          </EmptyLine>
        ) : null}
        <ul className="flex min-w-0 flex-col" aria-label="Previous versions">
          {(versions ?? []).map((version) => (
            <HistoryVersionRow
              key={version.backup.refName}
              version={version}
              nowSubjects={nowSubjects}
              nowMs={nowMs}
              hasUpstream={plan.hasUpstream}
              onReset={() => flow?.restoreBackup(version.backup)}
            />
          ))}
        </ul>
      </div>
    </DrawerFrame>
  );
};
