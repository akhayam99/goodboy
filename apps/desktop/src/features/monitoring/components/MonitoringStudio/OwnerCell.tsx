import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { Tooltip, TruncatedText, cn, FOCUS_RING, ICON_SIZE } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core/monitoring';
import { useAppStore } from '../../../../store';
import { usePortOwnerChain } from '../../hooks/usePortOwnerChain';
import { portOwnerPresentation } from '../../portOwnerPresentation';

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
  const presentation = portOwnerPresentation({ row, projects, sessionMounts });
  const chain = usePortOwnerChain({ row });

  return (
    <div className="flex min-w-0 items-center gap-2">
      {chain.length > 0 ? (
        <span className="flex min-w-0 max-w-full items-center gap-1 text-muted-foreground">
          {chain.map(({ kind, word, label, to }, index) => (
            <Fragment key={kind}>
              {index === 0 ? null : (
                <ChevronRight
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
              )}
              {word === null ? null : (
                <span className="shrink-0 text-faint-foreground">{word}</span>
              )}
              {to === null ? (
                <span className="flex min-w-0">
                  <TruncatedText>{label}</TruncatedText>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Open ${kind}: ${label}`}
                  className={cn(
                    'relative z-10 flex min-w-0 text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
                    FOCUS_RING,
                  )}
                  onClick={() => navigate({ to })}
                >
                  <TruncatedText>{label}</TruncatedText>
                </button>
              )}
            </Fragment>
          ))}
        </span>
      ) : presentation === null ? null : (
        <span
          className={cn(
            'flex min-w-0 max-w-full',
            presentation.isGoodboy ? 'text-muted-foreground' : 'text-faint-foreground',
          )}
        >
          <TruncatedText>{presentation.label}</TruncatedText>
        </span>
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
