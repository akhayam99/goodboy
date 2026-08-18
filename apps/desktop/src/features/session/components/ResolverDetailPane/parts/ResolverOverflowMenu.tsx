import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn, Divider, Popover, Tooltip, useDropdown } from '@goodboy/ui';
import type { Agent, BranchCommit } from '@goodboy/types';
import { RESOLVER_ACTION_ICON } from '../../../resolverActionIcon';
import type { ResolverAction, ResolverActionKind } from '../../../resolverActions';
import type { ResolverActionsController } from '../../../hooks/useResolverActions';
import { ResolverConfirm } from '../../ResolverConfirm';
import { BranchSurgery } from './BranchSurgery';

type Props = {
  readonly agent: Agent;
  readonly actions: ResolverActionsController;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly headSha: string | null;
  readonly onAmend: (sha: string, message: string) => Promise<void>;
  readonly onSquash: (sha: string, message: string) => Promise<void>;
};

type Armed = ResolverActionKind;

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors';

export const ResolverOverflowMenu = ({
  agent,
  actions,
  commits,
  headSha,
  onAmend,
  onSquash,
}: Props) => {
  const [armed, setArmed] = useState<Armed | null>(null);
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupClassName,
  } = useDropdown({ align: 'end', width: 'w-72', expectedHeight: 320 });

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setArmed(null);
  }, [isOpen]);

  useEffect(() => {
    close();
  }, [agent.id, close]);

  const armedAction: ResolverAction | null =
    actions.plan.overflow.find((action) => action.kind === armed) ?? null;

  if (actions.plan.overflow.length === 0 && commits.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content="More resolver actions">
        <button
          type="button"
          onClick={toggle}
          aria-label="More resolver actions"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={cn(
            'rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground',
            isOpen && 'bg-foreground/10 text-foreground',
          )}
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      </Tooltip>
      {isOpen && (
        <Popover
          role="menu"
          ariaLabel="More resolver actions"
          className={cn(popupClassName, 'py-1')}
        >
          {armedAction !== null && (
            <div className="p-2">
              <ResolverConfirm
                action={armedAction}
                onConfirm={async () => {
                  await actions.run(armedAction.kind);
                  close();
                }}
                onCancel={() => setArmed(null)}
              />
            </div>
          )}
          {armed === null && (
            <>
              {actions.plan.overflow.map((action) => {
                const Icon = RESOLVER_ACTION_ICON[action.kind];
                return (
                  <button
                    key={action.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => setArmed(action.kind)}
                    className={cn(
                      ITEM_CLASS,
                      action.role === 'danger'
                        ? 'text-danger/90 hover:bg-danger/10 hover:text-danger'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon size={11} aria-hidden className="shrink-0 text-muted-foreground/70" />
                    {action.label}
                  </button>
                );
              })}
              {commits.length > 0 && (
                <>
                  <Divider />
                  <BranchSurgery
                    commits={commits}
                    headSha={headSha}
                    onAmend={onAmend}
                    onSquash={onSquash}
                  />
                </>
              )}
            </>
          )}
        </Popover>
      )}
    </div>
  );
};
