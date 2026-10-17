import { Tooltip, cn } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core';
import { sessionPlace, useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { ownerPresentation } from '../../ownerPresentation';

type Props = {
  readonly row: PortRow;
};

type OthersParams = {
  readonly others: number;
};

const otherWorktrees = ({ others }: OthersParams): string =>
  `Also in ${others} other ${others === 1 ? 'worktree' : 'worktrees'}`;

export const OwnerCell = ({ row }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const navigate = useAppStore((state) => state.navigate);
  const isEcho = row.owner?.kind === 'external' && row.owner.name === row.processName;
  const presentation =
    row.owner === null || isEcho
      ? null
      : ownerPresentation({ owner: row.owner, projects, sessionMounts });
  const session = useAppStore((state) =>
    presentation?.sessionId === undefined || presentation.sessionId === null
      ? undefined
      : sessionById(state.sessions, presentation.sessionId),
  );

  const text =
    presentation === null ? null : <span className="truncate">{presentation.label}</span>;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {presentation === null || text === null ? null : (
        <Tooltip content={presentation.label} anchorClassName="min-w-0 max-w-full">
          {session === undefined ? (
            <span
              className={cn(
                'flex min-w-0 max-w-full',
                presentation.isGoodboy ? 'text-muted-foreground' : 'text-faint-foreground',
              )}
            >
              {text}
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Open session: ${presentation.label}`}
              className="relative z-10 flex min-w-0 max-w-full text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => navigate({ to: sessionPlace({ sessionId: session.id }) })}
            >
              {text}
            </button>
          )}
        </Tooltip>
      )}
      {row.collision === undefined ? null : (
        <Tooltip content={otherWorktrees({ others: row.collision.others })}>
          <span
            role="img"
            aria-label={otherWorktrees({ others: row.collision.others })}
            className="shrink-0 text-meta tabular-nums text-faint-foreground"
          >
            {`+${row.collision.others}`}
          </span>
        </Tooltip>
      )}
    </div>
  );
};
