import { Tooltip, cn, TruncatedText } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { agentDisplayName, isAutoResolverName } from '../../../../shared/utils/agentDisplayName';
import { agentObjectKey } from '../../../actions/agentObjectKey';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { useFixRunName } from '../../../resolve/hooks/useFixRunName';
import { classifyAgent } from '../../agent-kind';
import { agentHeadingOf } from './agentHeadingOf';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly brief?: string | null;
};

export const AgentTitle = ({ agent, sessionId, brief = null }: Props) => {
  const renameAgent = useAppStore((state) => state.renameAgent);
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const fixRunName = useFixRunName({ sessionId, agentId: agent.id });
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
            'w-full min-w-0 rounded-md bg-background px-2 py-0.5 text-title text-foreground outline-none ring-1',
            rename.error !== null ? 'ring-danger' : 'ring-primary',
          )}
        />
      </Tooltip>
    );
  }

  const kind = classifyAgent({ agent, override: kindOverride });
  const displayName =
    (kind === 'resolver' && isAutoResolverName({ name: agent.name }) ? fixRunName : null) ??
    agentHeadingOf({ name: agentDisplayName({ name: agent.name, kind }), kind, brief });

  return (
    <TruncatedText className="min-w-0 truncate" onDoubleClick={rename.start}>
      {displayName}
    </TruncatedText>
  );
};
