import { ROW_INTERACTIVE, WorkNode, cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { useAppStore } from '../../../store';
import { DelegationClock } from '../chat/DelegationClock';
import type { AutoGroup, AutoGroupChild } from '../autoGroupOf';
import { autoChildCopyOf } from './autoChildCopyOf';

type Props = {
  readonly group: AutoGroup;
  readonly child: AutoGroupChild;
};

export const AutoChildLine = ({ group, child }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const copy = autoChildCopyOf({ child });
  const name = `${child.label}, ${copy.word.toLowerCase()}`;
  return (
    <li data-auto-child={child.state} className="relative">
      <button
        type="button"
        aria-label={name}
        onClick={() =>
          openDrawer({
            kind: 'auto-child',
            sessionId: group.sessionId,
            payload: { agentId: child.agentId },
          })
        }
        className={cn(
          'flex w-full min-w-0 items-start gap-2 rounded-md px-1 py-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <span className="flex h-5 shrink-0 items-center">
          <WorkNode state={copy.node} label={name} mark={{ kind: 'dot' }} size="sm" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <AgentKindChip kind={child.kind} density="glyph" isDecorative />
            <span className="shrink-0 text-label text-foreground">{child.label}</span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-label',
                copy.isDanger ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {copy.isDanger ? copy.word : copy.text}
            </span>
            <DelegationClock agentId={child.agentId} isLive={copy.isLive} />
          </span>
          {copy.sub === null ? null : (
            <span
              data-auto-child-sub=""
              className="min-w-0 truncate text-meta text-muted-foreground"
            >
              {copy.sub}
            </span>
          )}
        </span>
      </button>
    </li>
  );
};
