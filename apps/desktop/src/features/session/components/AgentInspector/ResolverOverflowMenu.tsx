import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleDot, MoreHorizontal, Trash2 } from 'lucide-react';
import { Divider, InlineConfirm, Popover, cn } from '@goodboy/ui';
import type { Agent, BranchCommit, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverAction, ResolverActionKind } from '../../resolverActions';
import type { ResolverActionsController } from '../../hooks/useResolverActions';
import { ResolverConfirm } from '../ResolverConfirm';
import { BranchSurgery } from './BranchSurgery';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly actions: ResolverActionsController;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly headSha: string | null;
  readonly onAmend: (sha: string, message: string) => Promise<void>;
  readonly onSquash: (sha: string, message: string) => Promise<void>;
  readonly onDeleted?: () => void;
};

type Armed = ResolverActionKind | 'delete';

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors';

export const ResolverOverflowMenu = ({
  sessionId,
  agent,
  actions,
  commits,
  headSha,
  onAmend,
  onSquash,
  onDeleted,
}: Props) => {
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const [isOpen, setIsOpen] = useState(false);
  const [armed, setArmed] = useState<Armed | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node) === true) {
        return;
      }
      setIsOpen(false);
      setArmed(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setIsOpen(false);
      setArmed(null);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
    setArmed(null);
  }, [agent.id]);

  const armedAction: ResolverAction | null =
    actions.plan.overflow.find((action) => action.kind === armed) ?? null;

  const close = () => {
    setArmed(null);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="more resolver actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          'rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground',
          isOpen && 'bg-foreground/10 text-foreground',
        )}
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      {isOpen && (
        <Popover
          role="menu"
          ariaLabel="more resolver actions"
          className="absolute right-0 top-full z-40 mt-1 w-72 py-1"
        >
          {armedAction !== null && (
            <div className="p-2">
              <ResolverConfirm
                action={armedAction}
                explanation={actions.explanation}
                threadCount={actions.threadCount}
                onExplanationChange={actions.setExplanation}
                onConfirm={async () => {
                  await actions.run(armedAction.kind);
                  close();
                }}
                onCancel={() => setArmed(null)}
              />
            </div>
          )}
          {armed === 'delete' && (
            <div className="p-2">
              <InlineConfirm
                role="danger"
                icon={<Trash2 size={12} aria-hidden />}
                title="Delete this resolver?"
                description="Removes the agent and its transcript from the session."
                confirmLabel="Delete"
                onConfirm={async () => {
                  await deleteAgent(sessionId, agent.id);
                  close();
                  onDeleted?.();
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
                    onClick={() => {
                      actions.resetExplanation();
                      setArmed(action.kind);
                    }}
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
              {agent.doneAt == null ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void setAgentDone(sessionId, agent.id);
                    close();
                  }}
                  className={cn(
                    ITEM_CLASS,
                    'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <CircleCheck
                    size={11}
                    aria-hidden
                    className="shrink-0 text-muted-foreground/70"
                  />
                  Mark done
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void clearAgentDone(sessionId, agent.id);
                    close();
                  }}
                  className={cn(
                    ITEM_CLASS,
                    'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <CircleDot size={11} aria-hidden className="shrink-0 text-muted-foreground/70" />
                  Reopen
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => setArmed('delete')}
                className={cn(ITEM_CLASS, 'text-danger/90 hover:bg-danger/10 hover:text-danger')}
              >
                <Trash2 size={11} aria-hidden className="shrink-0 text-danger/70" />
                Delete
              </button>
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
