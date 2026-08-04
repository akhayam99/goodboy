import type { AgentId, ProviderId } from '@goodboy/types';
import { Checkbox, cn } from '@goodboy/ui';
import { ArrowUpRight, ChevronDown, ExternalLink, RotateCcw, Sparkles } from 'lucide-react';
import { modelEffortLevels } from '../../../../chat/utils/chat-constants';
import { RoutingBadge } from '../../../../../shared/components/RoutingBadge';
import type { CommentThread } from '../../../comment-threads';
import {
  ResolverStateBadge,
  resolverBadgeState,
} from '../../../../session/components/ResolverStateBadge';
import type { ResolverLink } from '../../../../session/resolver-linkage';
import { ResolveConfigPopover } from './ResolveConfigPopover';
import { isClaimedLink } from './isClaimedLink';
import type { CardConfig } from './config';

type Props = {
  readonly thread: CommentThread;
  readonly config: CardConfig;
  readonly checked: boolean;
  readonly link?: ResolverLink;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onToggle: () => void;
  readonly onConfig: (next: CardConfig) => void;
  readonly onResolve: () => void;
  readonly onOpenResolver?: (agentId: AgentId) => void;
  readonly onOpenThread?: () => void;
};

export const ResolveCard = ({
  thread,
  config,
  checked,
  link,
  connectedProviders,
  onToggle,
  onConfig,
  onResolve,
  onOpenResolver,
  onOpenThread,
}: Props) => {
  const { head, replies } = thread;
  const loc = head.path ? `${head.path}${head.line ? `:${head.line}` : ''}` : 'conversation';
  const claimed = isClaimedLink({ link });
  const failed = link != null && link.status === 'failed';
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        checked ? 'border-border bg-muted/10' : 'border-border-soft/60 bg-muted/5 opacity-70',
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked && !claimed}
          disabled={claimed}
          onChange={onToggle}
          ariaLabel={`Include comment by ${head.author}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{head.author}</span>
            <span className="opacity-50">·</span>
            <span className="min-w-0 truncate font-mono text-2xs">{loc}</span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {link ? <ResolverStateBadge state={resolverBadgeState(link.status)} /> : null}
              {onOpenThread ? (
                <button
                  type="button"
                  onClick={onOpenThread}
                  title="Open the full thread"
                  aria-label="Open the full thread"
                  className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink size={12} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
            {head.body.trim() || '(empty)'}
          </p>

          {replies.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-l border-border-soft pl-2.5">
              {replies.map((r) => (
                <div key={r.id} className="flex flex-col gap-0.5">
                  <span className="text-2xs font-medium text-muted-foreground">{r.author}</span>
                  <p className="line-clamp-2 whitespace-pre-wrap text-xs leading-snug text-muted-foreground/80 [overflow-wrap:anywhere]">
                    {r.body.trim() || '(empty)'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {claimed && link ? (
              <button
                type="button"
                onClick={() => onOpenResolver?.(link.agent.id as AgentId)}
                title="Open the resolver working on this comment"
                className="inline-flex items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 text-2xs font-semibold text-info transition-colors hover:bg-info/20"
              >
                Open resolver
                <ArrowUpRight size={11} aria-hidden />
              </button>
            ) : (
              <>
                <ResolveConfigPopover
                  ariaLabel="Configure resolver"
                  config={config}
                  connectedProviders={connectedProviders}
                  primaryLabel="Resolve comment"
                  onChange={onConfig}
                  onPrimary={onResolve}
                  renderTrigger={(open, toggle) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1 text-2xs transition-colors hover:bg-muted/50"
                    >
                      <span className="text-muted-foreground">Resolve with</span>
                      <RoutingBadge
                        provider={config.provider}
                        model={config.model}
                        effort={modelEffortLevels(config.model) ? config.effort : null}
                      />
                      <ChevronDown size={11} aria-hidden className="text-muted-foreground" />
                    </button>
                  )}
                />
                <button
                  type="button"
                  onClick={onResolve}
                  title={
                    failed
                      ? 'Retry the resolver for this comment'
                      : 'Spawn a resolver for this comment now'
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition-colors',
                    failed
                      ? 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20'
                      : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
                  )}
                >
                  {failed ? (
                    <RotateCcw size={11} aria-hidden />
                  ) : (
                    <Sparkles size={11} aria-hidden />
                  )}
                  {failed ? 'Retry' : 'Resolve'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
