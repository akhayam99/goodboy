import { Tooltip, cn, TruncatedText, IconButton } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { agentDisplayName, isAutoResolverName } from '../../../../shared/utils/agentDisplayName';
import { useFixRunName } from '../../../resolve/hooks/useFixRunName';
import { classifyAgent } from '../../agent-kind';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
};

export const AgentTitle = ({ agent, sessionId }: Props) => {
  const renameAgent = useAppStore((state) => state.renameAgent);
  const fixRunName = useFixRunName({ sessionId, agentId: agent.id });
  const rename = useInlineRename({
    value: agent.name,
    onCommit: (next) => renameAgent(sessionId, agent.id, next),
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
            'w-full min-w-0 rounded-md bg-background px-2 py-0.5 text-title text-foreground outline-none ring-1',
            rename.error !== null ? 'ring-danger' : 'ring-primary',
          )}
        />
      </Tooltip>
    );
  }

  const kind = classifyAgent({ agent, override: null });
  const displayName =
    (kind === 'resolver' && isAutoResolverName({ name: agent.name }) ? fixRunName : null) ??
    agentDisplayName({ name: agent.name, kind });

  return (
    <span className="group/title flex min-w-0 items-center gap-2">
      <TruncatedText className="min-w-0 truncate" onDoubleClick={rename.start}>
        {displayName}
      </TruncatedText>
      <IconButton
        icon={CONCEPT_ICONS.rename}
        label="Rename agent"
        tooltipSide="top"
        size="xs"
        onClick={rename.start}
        className="size-5 opacity-0 focus-visible:opacity-100 group-hover/title:opacity-100 motion-reduce:opacity-60"
      />
    </span>
  );
};
