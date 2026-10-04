import { Tooltip, cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { agentDisplayName } from '../../../../shared/utils/agentDisplayName';
import { classifyAgent } from '../../agent-kind';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
};

export const AgentTitle = ({ agent, sessionId }: Props) => {
  const renameAgent = useAppStore((state) => state.renameAgent);
  const rename = useInlineRename({
    value: agent.name,
    onCommit: (next) => renameAgent(sessionId, agent.id, next),
  });

  if (rename.editing) {
    return (
      <input
        autoFocus
        value={rename.draft}
        aria-label="Rename agent"
        onChange={(event) => rename.setDraft(event.target.value)}
        onKeyDown={rename.onKeyDown}
        onBlur={rename.onBlur}
        title={rename.error ?? undefined}
        aria-invalid={rename.error !== null}
        className={cn(
          'w-full min-w-0 rounded-md bg-background px-2 py-0.5 text-title text-foreground outline-none ring-1',
          rename.error !== null ? 'ring-danger' : 'ring-primary',
        )}
      />
    );
  }

  const displayName = agentDisplayName({
    name: agent.name,
    kind: classifyAgent({ agent, override: null }),
  });

  return (
    <span className="group/title flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate" onDoubleClick={rename.start} title={displayName}>
        {displayName}
      </span>
      <Tooltip content="Rename agent" side="top">
        <button
          type="button"
          onClick={rename.start}
          aria-label="Rename agent"
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-faint-foreground',
            'opacity-0 transition-[opacity,color,background-color] hover:bg-hover hover:text-foreground',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            'group-hover/title:opacity-100 motion-reduce:opacity-60',
          )}
        >
          <CONCEPT_ICONS.rename size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
};
