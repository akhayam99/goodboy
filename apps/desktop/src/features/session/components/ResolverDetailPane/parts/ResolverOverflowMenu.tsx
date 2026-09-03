import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { AnchoredPopover, cn, Tooltip, useDropdown } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { RESOLVER_ACTION_ICON } from '../../../resolverActionIcon';
import type { ResolverAction, ResolverActionKind } from '../../../resolverActions';
import type { ResolverActionsController } from '../../../hooks/useResolverActions';
import { ResolverConfirm } from '../../ResolverConfirm';

type Props = {
  readonly agent: Agent;
  readonly actions: ResolverActionsController;
};

type Armed = ResolverActionKind;

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors';

export const ResolverOverflowMenu = ({ agent, actions }: Props) => {
  const [armed, setArmed] = useState<Armed | null>(null);
  const dropdown = useDropdown({ align: 'end', width: 'w-72', expectedHeight: 320 });
  const { open: isOpen, close, toggle } = dropdown;

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

  if (actions.plan.overflow.length === 0) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="More resolver actions"
      className="py-1"
      trigger={
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
      }
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
        </>
      )}
    </AnchoredPopover>
  );
};
