import { Pencil } from 'lucide-react';
import { Input } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SessionStageBadge } from '../../../session/components/SessionStageBadge';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { useSessionTitleRename } from '../../../session/hooks/useSessionTitleRename';

type Props = {
  readonly session: Session;
};

export const SessionDetailPanel = ({ session }: Props) => {
  const externalTasks = useAppStore(
    (s) => s.sessionExternalTasks[session.id as SessionId] ?? EMPTY_ARRAY,
  );
  const rename = useSessionTitleRename({
    sessionId: session.id as SessionId,
    currentTitle: session.goal,
  });

  return (
    <div className="flex shrink-0 items-center gap-2 px-2 pb-2 pt-2.5">
      <SessionStageBadge session={session} />
      <div className="group/goal flex min-w-0 flex-1 items-center gap-1.5">
        {rename.renaming ? (
          <div className="flex flex-1 flex-col gap-0.5">
            <Input
              autoFocus
              value={rename.draft}
              maxLength={rename.maxLength}
              onChange={(e) => rename.setDraft(e.target.value)}
              onBlur={() => void rename.commit()}
              onKeyDown={rename.onKeyDown}
              aria-label="session goal"
              className="h-7 text-xs font-semibold"
            />
            {rename.error && <span className="text-2xs text-danger">{rename.error}</span>}
          </div>
        ) : (
          <>
            <span className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug text-foreground">
              {session.goal}
            </span>
            <button
              type="button"
              onClick={rename.start}
              title="Edit goal"
              aria-label="edit goal"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-[opacity,color,background-color] hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-hover/goal:opacity-100 motion-reduce:opacity-60"
            >
              <Pencil size={11} aria-hidden />
            </button>
          </>
        )}
      </div>
      {externalTasks.map((task) => (
        <ExternalTaskChip key={`${task.provider}:${task.externalId}`} task={task} variant="full" />
      ))}
    </div>
  );
};
