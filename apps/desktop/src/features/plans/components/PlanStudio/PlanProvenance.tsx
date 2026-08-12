import { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Divider, MetaRow, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, AgentId, PlanConsumption } from '@goodboy/types';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { DropdownPortal } from '../../../../shared/hooks/useDropdown/DropdownPortal';
import { fmtTimestamp } from './fmtTimestamp';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly creatorName: string;
  readonly creatorAgentId: AgentId;
  readonly creatorDeleted: boolean;
  readonly createdAt: string;
  readonly consumptions: ReadonlyArray<PlanConsumption>;
  readonly agents: ReadonlyArray<Agent>;
  readonly onAgentClick: (agentId: AgentId, name: string, deleted: boolean) => void;
};

export const PlanProvenance = ({
  creatorName,
  creatorAgentId,
  creatorDeleted,
  createdAt,
  consumptions,
  agents,
  onAgentClick,
}: Props) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, toggle, containerRef, popupRef, popupClassName, popupStyle, portal, portalTarget } =
    useDropdown({
      disabled: consumptions.length === 0,
      align: 'start',
      expectedHeight: 260,
      expectedWidth: 320,
      width: 'w-80 max-w-[calc(100vw-2rem)]',
      strategy: 'fixed',
    });

  const runLabel = consumptions.length === 1 ? 'ran once' : `ran ${consumptions.length} times`;
  const popoverTitle = consumptions.length === 1 ? 'Ran once' : `Ran ${consumptions.length} times`;

  return (
    <div ref={containerRef} className="relative inline-flex min-w-0">
      <MetaRow
        items={[
          <span key="creator" className="inline-flex min-w-0 items-center gap-1.5">
            <CONCEPT_ICONS.agents size={11} aria-hidden className="shrink-0 text-primary" />
            <span>Created by</span>
            <button
              type="button"
              onClick={() => onAgentClick(creatorAgentId, creatorName, creatorDeleted)}
              className={cn(
                'truncate font-medium underline-offset-2',
                creatorDeleted
                  ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                  : 'text-foreground hover:underline',
              )}
              title={creatorDeleted ? 'Agent deleted, click for details' : 'Open creator agent'}
            >
              {creatorName}
            </button>
            {creatorDeleted ? (
              <span className="shrink-0 rounded-sm bg-muted px-1 text-2xs uppercase tracking-wide text-muted-foreground">
                Deleted
              </span>
            ) : null}
          </span>,
          consumptions.length > 0 ? (
            <button
              key="consumptions"
              ref={triggerRef}
              type="button"
              onClick={toggle}
              aria-haspopup="dialog"
              aria-expanded={open}
              title="See who consumed this plan"
              className={cn(
                'underline-offset-2 hover:text-foreground hover:underline',
                open && 'text-foreground underline',
              )}
            >
              {runLabel}
            </button>
          ) : null,
          <span key="timestamp" className="shrink-0">
            {fmtTimestamp(createdAt)}
          </span>,
        ]}
      />
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open ? (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel="Plan consumption history"
            tabIndex={-1}
            className={cn(popupClassName, 'flex max-h-80 flex-col bg-elevated')}
            style={popupStyle}
          >
            <div className="px-3 py-2 text-2xs font-medium text-foreground">{popoverTitle}</div>
            <Divider />
            <ScrollFade
              className="min-h-0 flex-1"
              viewportClassName="flex flex-col gap-2 px-3 py-2"
            >
              {consumptions.map((c) => {
                const ag = agents.find((a) => a.id === c.agentId);
                const isDeleted = !ag;
                const displayName = ag?.name ?? c.agentName ?? c.agentId.substring(0, 8);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 text-2xs text-muted-foreground"
                  >
                    <CheckCircle2 size={11} aria-hidden className="shrink-0 text-info" />
                    <span>Consumed by</span>
                    <button
                      type="button"
                      onClick={() => onAgentClick(c.agentId, displayName, isDeleted)}
                      className={cn(
                        'truncate font-medium underline-offset-2',
                        isDeleted
                          ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                          : 'text-foreground hover:underline',
                      )}
                      title={isDeleted ? 'Agent deleted, click for details' : 'Open agent'}
                    >
                      {displayName}
                    </button>
                    {isDeleted ? (
                      <span className="shrink-0 rounded-sm bg-muted px-1 text-2xs uppercase tracking-wide text-muted-foreground">
                        Deleted
                      </span>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{fmtTimestamp(c.consumedAt)}</span>
                  </div>
                );
              })}
            </ScrollFade>
          </Popover>
        ) : null}
      </DropdownPortal>
    </div>
  );
};
