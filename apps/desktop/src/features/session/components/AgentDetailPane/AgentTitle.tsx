import { useMemo, useState } from 'react';
import { InteractiveRow, ScrollFade, Tooltip, cn, TruncatedText } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { agentDisplayName, isAutoResolverName } from '../../../../shared/utils/agentDisplayName';
import { agentObjectKey } from '../../../actions/agentObjectKey';
import { useRenameRequest } from '../../../../shared/hooks/useRenameRequest';
import { useFixRunName } from '../../../resolve/hooks/useFixRunName';
import { classifyAgent } from '../../agent-kind';
import { agentTaskLabelOf } from '../../../auto/agentTaskLabelOf';
import { autoRunTitleOf } from '../../autoRunTitleOf';
import { AgentBriefCrumb } from './AgentBriefCrumb';
import { agentHeadingOf } from './agentHeadingOf';
import { firstLineOf } from '../../../../shared/utils/firstLineOf';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly brief?: string | null;
  readonly heading?: string;
  readonly isInline?: boolean;
};

export const AgentTitle = ({
  agent,
  sessionId,
  brief = null,
  heading,
  isInline = false,
}: Props) => {
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const renameAgent = useAppStore((state) => state.renameAgent);
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const fixRunName = useFixRunName({ sessionId, agentId: agent.id });
  const views = useAppStore((state) => state.autoTreeViews[sessionId]);
  const task = useMemo(() => agentTaskLabelOf({ views, agentId: agent.id }), [views, agent.id]);
  const runTitle = useAppStore((state) => autoRunTitleOf({ state, sessionId, agentId: agent.id }));
  const rename = useInlineRename({
    value: agent.name,
    onCommit: (next) => renameAgent(sessionId, agent.id, next),
  });
  useRenameRequest({
    objectKey: agentObjectKey({ agentId: agent.id }),
    anchorKeys: [`agent-header:${agent.id}`],
    onRename: rename.start,
  });

  if (rename.editing) {
    return (
      <Tooltip content={rename.error ?? undefined}>
        <input
          autoFocus
          value={rename.draft}
          aria-label="Rename agent"
          onChange={(event) => rename.setDraft(event.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
          aria-invalid={rename.error !== null}
          className={cn(
            'w-full min-w-0 rounded-md bg-background px-2 py-0.5 text-foreground outline-none ring-1',
            isInline ? 'text-meta' : 'text-title',
            rename.error !== null ? 'ring-danger' : 'ring-primary',
          )}
        />
      </Tooltip>
    );
  }

  const kind = classifyAgent({ agent, override: kindOverride });
  const fullName =
    heading ??
    (kind === 'resolver' && isAutoResolverName({ name: agent.name }) ? fixRunName : null) ??
    agentHeadingOf({ name: agentDisplayName({ name: agent.name, kind }), kind, brief });
  const displayName = brief === null && heading === undefined ? (runTitle ?? fullName) : fullName;

  if (brief !== null && displayName === brief && isInline) {
    return <AgentBriefCrumb brief={brief} task={task} label={runTitle} onRename={rename.start} />;
  }

  if (brief !== null && displayName === brief) {
    return (
      <InteractiveRow
        label={isBriefOpen ? 'Hide full brief' : 'Read full brief'}
        isSelected={false}
        onOpen={() => setIsBriefOpen((wasOpen) => !wasOpen)}
        frameClassName="min-w-0"
        className="min-w-0"
      >
        <ScrollFade className={isBriefOpen ? 'max-h-48' : undefined} fadeSize="h-6">
          <TruncatedText
            className={cn(
              'block min-w-0 text-left',
              isBriefOpen ? 'whitespace-pre-wrap break-words' : 'truncate',
            )}
            onDoubleClick={rename.start}
          >
            {isBriefOpen ? brief : (firstLineOf({ text: brief }) ?? brief)}
          </TruncatedText>
        </ScrollFade>
      </InteractiveRow>
    );
  }

  return (
    <TruncatedText className="min-w-0 truncate" onDoubleClick={rename.start}>
      {displayName}
    </TruncatedText>
  );
};
