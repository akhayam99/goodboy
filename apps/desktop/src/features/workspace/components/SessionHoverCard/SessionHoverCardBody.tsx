import { ArrowRight, Folder } from 'lucide-react';
import {
  Chip,
  FactCardFootnote,
  FactCardHeader,
  FactCardState,
  GhostActionButton,
  StatusDot,
  formatUsd,
} from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/names';
import { useReviewDraftCount } from './useReviewDraftCount';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { SessionProgress } from '../SessionProgress';
import { StateNode } from '../../../../shared/components/StateNode';
import { sessionNodeOf } from '../../../session/sessionNode';
import { getLinkedRequest } from '../StageBoard/StageBoardCard/getLinkedRequest';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pullRequestStateToneOf } from '../../../branch/pullRequestStateToneOf';
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
  readonly onOpenLegend: () => void;
  readonly isFactsOnly?: boolean;
};

export const SessionHoverCardBody = ({
  session,
  isArchived,
  onOpenAttention,
  onOpenLegend,
  isFactsOnly = false,
}: Props) => {
  const sessionId = session.id as SessionId;
  const summary = useSessionSummary({ session });
  const pullRequest = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const mergeRequest = useAppStore((state) => state.sessionGitlabMr[sessionId]?.mr ?? null);
  const mounts = useAppStore((state) => state.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const isPinned = useAppStore((state) =>
    (state.sessionPins?.[session.workspaceId] ?? EMPTY_ARRAY).some((pin) => pin.id === sessionId),
  );
  const isNamedByGoodboy = useAppStore(
    (state) => state.goodboyNamedSessionId === sessionId && session.titleUserEdited !== true,
  );
  const draftCount = useReviewDraftCount({ sessionId });
  const projectMounts = mounts.filter(
    (mount, index) => mounts.findIndex((other) => other.projectId === mount.projectId) === index,
  );
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
  const linked = getLinkedRequest({ pullRequest, mergeRequest });
  const request = linked.state === 'none' ? null : pullRequestStateToneOf({ state: linked.state });
  const RequestIcon = request?.icon;
  const agentWord = summary.agentCount === 1 ? 'agent' : 'agents';
  const draftWord = draftCount === 1 ? 'draft comment' : 'draft comments';
  const facts = [
    isPinned && !isArchived ? 'Pinned' : null,
    isNamedByGoodboy ? 'Named by Goodboy' : null,
    summary.isAutorun ? NAMES.autopilot : null,
    `${summary.agentCount} ${agentWord}`,
    draftCount > 0 ? `${draftCount} ${draftWord}` : null,
    summary.cost > 0 ? formatUsd(summary.cost) : null,
    summary.age === '' ? null : summary.age,
  ].filter((fact): fact is string => fact !== null);
  const stateText = isArchived
    ? 'Archived'
    : (summary.words ??
      [stageWord({ stage: summary.stage }), summary.addsFact ? summary.reason : null]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · '));
  const needsYou = summary.stage === 'attention' && summary.attention !== null;
  const isWorking = !isArchived && summary.isRunning && needsYou;
  const otherLines = isArchived ? [] : summary.otherLines;

  return (
    <div className="flex flex-col gap-3">
      <FactCardHeader
        title={
          <SessionRowTitle
            keys={keys}
            title={title}
            titleClassName="text-heading text-foreground"
          />
        }
      />
      <div className="flex flex-col gap-1">
        <FactCardState glyph={<StateNode node={node} />} words={stateText} />
        {isWorking ? (
          <FactCardState
            glyph={<StatusDot tone="info" size="sm" pulsing />}
            words="An agent is working"
          />
        ) : null}
        {otherLines.map((line) => (
          <FactCardState
            key={line.reason}
            glyph={<StatusDot tone={line.tone} size="sm" />}
            words={<span data-attention-line={line.reason}>{line.words}</span>}
          />
        ))}
      </div>
      {summary.progress === null ? null : (
        <SessionProgress progress={summary.progress} tone={summary.tone} />
      )}
      {request !== null || summary.tasks.length > 0 || projectMounts.length > 0 ? (
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
          {projectMounts.map((mount) => (
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
      <FactCardFootnote text={facts.join(' · ')} />
      {needsYou && !isFactsOnly ? (
        <GhostActionButton
          icon={ArrowRight}
          label="Open what needs you"
          onClick={() => onOpenAttention({ sessionId, reason: summary.attention })}
        />
      ) : null}
      {isFactsOnly ? null : (
        <GhostActionButton
          icon={CONCEPT_ICONS.help}
          label="What do these marks mean?"
          onClick={onOpenLegend}
        />
      )}
    </div>
  );
};
