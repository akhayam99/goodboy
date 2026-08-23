import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, ScrollFade, cn, useDropdown } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { CRUMB_BUTTON_CLASS, CRUMB_LAST_CLASS, SIBLING_GROUP_LABEL_CLASS } from './crumbClasses';
import { SiblingRow } from './SiblingRow';
import type { SwitcherEntry } from './switcherEntry';

type AgentSwitcherCrumbProps = {
  readonly label: string;
  readonly siblings: ReadonlyArray<SwitcherEntry>;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
};

export const AgentSwitcherCrumb = ({
  label,
  siblings,
  selectedAgentId,
  onSelect,
}: AgentSwitcherCrumbProps) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 260,
    expectedWidth: 256,
    width: 'w-64 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const active = siblings.filter((entry) => !entry.isFinished);
  const done = siblings.filter((entry) => entry.isFinished);
  const showGroups = active.length > 0 && done.length > 0;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Switch agent"
      className="bg-subtle"
      anchorClassName="flex min-w-0 items-center"
      trigger={
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
      }
    >
      <ScrollFade fadeFrom="subtle" className="min-h-0 flex-1" viewportClassName="max-h-64">
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
    </AnchoredPopover>
  );
};
