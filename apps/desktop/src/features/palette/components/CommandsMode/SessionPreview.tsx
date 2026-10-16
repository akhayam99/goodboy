import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionStageInfo, useWorkspaces } from '../../../../store';
import { describeSessionStage } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { PreviewFacts } from './PreviewFacts';
import { PreviewHeader } from './PreviewHeader';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly session: Session;
  readonly subject: string | null;
};

export const SessionPreview = ({ session, subject }: Props) => {
  const now = useNow(30_000);
  const sessionId = session.id as SessionId;
  const stage = describeSessionStage(useSessionStageInfo(session));
  const mount = useAppStore((s) => s.sessionProjectMounts[sessionId]?.[0] ?? null);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const agentCount = useAppStore(
    (s) =>
      (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).filter((agent) => agent.deletedAt == null)
        .length,
  );
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const workspaces = useWorkspaces();
  const workspace = workspaces.find((candidate) => candidate.id === session.workspaceId);
  const shownBranch = branch !== null && branch.trim() !== '' ? branch : (mount?.branch ?? null);
  const title = sessionTitle({ session });
  const isNamedByScope = subject === title;
  return (
    <div className="flex flex-col gap-4">
      {isNamedByScope ? null : (
        <PreviewHeader
          title={title}
          subtitle={joinFacts({
            facts: [
              workspaces.length > 1 ? workspace?.name : null,
              formatAge({ from: session.updatedAt, now }),
            ],
          })}
        />
      )}
      <PreviewFacts
        facts={[
          {
            label: 'Stage',
            value: `${stage.label.charAt(0).toUpperCase()}${stage.label.slice(1)}`,
          },
          ...(mount === null ? [] : [{ label: 'Project', value: mount.mountName }]),
          ...(shownBranch === null
            ? []
            : [{ label: 'Branch', value: <span className="text-code">{shownBranch}</span> }]),
          ...(agentCount === 0 ? [] : [{ label: 'Agents', value: String(agentCount) }]),
          ...(pr === null ? [] : [{ label: 'Pull request', value: `#${pr.number} ${pr.state}` }]),
        ]}
      />
    </div>
  );
};
