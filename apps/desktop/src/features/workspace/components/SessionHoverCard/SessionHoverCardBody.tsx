import { Fragment } from 'react';
import { ArrowRight, Folder } from 'lucide-react';
import { Chip, GhostActionButton, StatusDot, formatUsd } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { SessionProgress } from '../SessionProgress';
import { SessionStateNode } from '../SessionActivityBar/SessionStateNode';
import { sessionNodeOf } from '../SessionActivityBar/sessionNode';
import { getLinkedRequest } from '../StageBoard/StageBoardCard/getLinkedRequest';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PULL_REQUEST_PRESENTATION } from '../../../../shared/pullRequestPresentation';
import { requestChipLabel } from './requestChipLabel';
import { stageWord } from './stageWord';

type OpenAttention = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type Props = {
  readonly session: Session;
  readonly isArchived: boolean;
  readonly onOpenAttention: (params: OpenAttention) => void;
};

export const SessionHoverCardBody = ({ session, isArchived, onOpenAttention }: Props) => {
  const sessionId = session.id as SessionId;
  const summary = useSessionSummary({ session });
  const pullRequest = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const mergeRequest = useAppStore((state) => state.sessionGitlabMr[sessionId]?.mr ?? null);
  const mounts = useAppStore((state) => state.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
  const linked = getLinkedRequest({ pullRequest, mergeRequest });
  const request = linked.state === 'none' ? null : PULL_REQUEST_PRESENTATION[linked.state];
  const RequestIcon = request?.icon;
  const agentWord = summary.agentCount === 1 ? 'agent' : 'agents';
  const facts = [
    `${summary.agentCount} ${agentWord}`,
    summary.cost > 0 ? formatUsd(summary.cost) : null,
    summary.age === '' ? null : summary.age,
  ].filter((fact): fact is string => fact !== null);
  const stateText = isArchived
    ? 'Archived'
    : (summary.words ??
      [stageWord({ stage: summary.stage }), summary.addsFact ? summary.reason : null]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · '));
  const isWorking = !isArchived && summary.isRunning && summary.attention !== null;
  const otherLines = isArchived ? [] : summary.otherLines;

  return (
    <div className="flex flex-col gap-3">
      <SessionRowTitle keys={keys} title={title} titleClassName="text-heading text-foreground" />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
        <SessionStateNode node={node} />
        <span className="min-w-0">{stateText}</span>
        {isWorking ? (
          <>
            <StatusDot tone="info" size="sm" pulsing className="justify-self-center" />
            <span className="min-w-0">An agent is working</span>
          </>
        ) : null}
        {otherLines.map((line) => (
          <Fragment key={line.reason}>
            <StatusDot tone={line.tone} size="sm" className="justify-self-center" />
            <span className="min-w-0" data-attention-line={line.reason}>
              {line.words}
            </span>
          </Fragment>
        ))}
      </div>
      {summary.progress === null ? null : (
        <SessionProgress progress={summary.progress} tone={summary.tone} />
      )}
      {request !== null || summary.tasks.length > 0 || mounts.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {request !== null && RequestIcon !== undefined ? (
            <Chip
              tone={request.tone}
              size="xs"
              icon={<RequestIcon size={ICON_SIZE.row} aria-hidden />}
              label={requestChipLabel({ linked, pullRequest })}
            />
          ) : null}
          {summary.tasks.map((task) => (
            <ExternalTaskChip
              key={`${task.provider}:${task.externalId}`}
              task={task}
              variant="compact"
            />
          ))}
          {mounts.map((mount) => (
            <Chip
              key={mount.mountId}
              tone="neutral"
              size="xs"
              icon={<Folder size={ICON_SIZE.row} aria-hidden />}
              label={mount.mountName}
            />
          ))}
        </div>
      ) : null}
      <span className="text-meta text-faint-foreground">{facts.join(' · ')}</span>
      {summary.attention === null ? null : (
        <GhostActionButton
          icon={ArrowRight}
          label="Open what needs you"
          onClick={() => onOpenAttention({ sessionId, reason: summary.attention })}
        />
      )}
    </div>
  );
};
