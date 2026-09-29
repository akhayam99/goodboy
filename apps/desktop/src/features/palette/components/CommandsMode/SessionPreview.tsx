import type { Session, SessionId } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionCost,
  useSessionStageInfo,
  useWorkspaces,
} from '../../../../store';
import { describeSessionStage } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { PreviewFacts } from './PreviewFacts';
import { PreviewHeader } from './PreviewHeader';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly session: Session;
};

export const SessionPreview = ({ session }: Props) => {
  const now = useNow(30_000);
  const sessionId = session.id as SessionId;
  const stage = describeSessionStage(useSessionStageInfo(session));
  const cost = useSessionCost(sessionId);
  const mount = useAppStore((s) => s.sessionProjectMounts[sessionId]?.[0] ?? null);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const agentCount = useAppStore(
    (s) =>
      (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).filter((agent) => agent.deletedAt == null)
        .length,
  );
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const workspace = useWorkspaces().find((candidate) => candidate.id === session.workspaceId);
  const shownBranch = branch !== null && branch.trim() !== '' ? branch : (mount?.branch ?? null);
  return (
    <div className="flex flex-col gap-4">
      <PreviewHeader
        title={sessionTitle({ session })}
        subtitle={[workspace?.name, `updated ${formatAge({ from: session.updatedAt, now })}`]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ')}
      />
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
          { label: 'Agents', value: String(agentCount) },
          { label: 'Spend', value: formatUsd(cost) },
          { label: 'Pull request', value: pr === null ? 'none yet' : `#${pr.number} ${pr.state}` },
        ]}
      />
    </div>
  );
};
