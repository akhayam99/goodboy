import { ChevronDown } from 'lucide-react';
import { Popover, ScrollFade, cn, useDropdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, SIBLING_GROUP_LABEL_CLASS } from './crumbClasses';
import { SiblingRow } from './SiblingRow';
import type { SwitcherEntry } from './switcherEntry';

type AgentSwitcherCrumbProps = {
  readonly sessionId: SessionId;
  readonly label: string;
  readonly siblings: ReadonlyArray<SwitcherEntry>;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
};

export const AgentSwitcherCrumb = ({
  sessionId: _sessionId,
  label,
  siblings,
  selectedAgentId,
  onSelect,
}: AgentSwitcherCrumbProps) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    align: 'start',
    expectedHeight: 260,
    width: 'w-64 max-w-[calc(100vw-2rem)]',
  });
  const active = siblings.filter((entry) => !entry.isFinished);
  const done = siblings.filter((entry) => entry.isFinished);
  const showGroups = active.length > 0 && done.length > 0;

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center">
      <button
        type="button"
        onClick={toggle}
        title={`${label}. Switch agent.`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, 'inline-flex items-center gap-1')}
      >
        <span className="min-w-0 max-w-48 truncate">{label}</span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn('shrink-0 text-muted-foreground/60', open && 'rotate-180')}
        />
      </button>
      {open && (
        <Popover
          role="menu"
          ariaLabel="Switch agent"
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
        >
          <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-64">
            <div className="flex flex-col gap-0.5 p-1">
              {active.length > 0 && (
                <>
                  {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Active</span>}
                  {active.map((entry) => (
                    <SiblingRow
                      key={entry.agent.id}
                      entry={entry}
                      selectedAgentId={selectedAgentId}
                      onSelect={(id) => {
                        close();
                        onSelect(id);
                      }}
                    />
                  ))}
                </>
              )}
              {done.length > 0 && (
                <>
                  {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Done</span>}
                  {done.map((entry) => (
                    <SiblingRow
                      key={entry.agent.id}
                      entry={entry}
                      selectedAgentId={selectedAgentId}
                      onSelect={(id) => {
                        close();
                        onSelect(id);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollFade>
        </Popover>
      )}
    </div>
  );
};
