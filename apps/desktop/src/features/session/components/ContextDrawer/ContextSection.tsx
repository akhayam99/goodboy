import { useId, useState, type ReactNode } from 'react';
import { Band, Reveal, SectionHeader } from '@goodboy/ui';
import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';
import { CONTEXT_SECTION_LABEL } from './contextSections';
import { ContextVisibility } from './ContextVisibility';
import { SlotSourceActions } from './SlotSourceActions';
import type { Visibility } from './roleVisibility';

const COUNT_FLOOR = 2;

type Props = {
  readonly section: ContextDrawerSection;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly visibility?: Visibility | null;
  readonly children: ReactNode;
  readonly isLocked?: boolean;
  readonly historyCount?: number;
  readonly onEdit?: () => void;
  readonly onOpenVersions?: () => void;
};

export const ContextSection = ({
  section,
  count,
  action,
  visibility = null,
  children,
  isLocked = false,
  historyCount = 0,
  onEdit,
  onOpenVersions,
}: Props) => {
  const panelId = useId();
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const label = CONTEXT_SECTION_LABEL[section];
  const hasCount = count !== undefined && count >= COUNT_FLOOR;
  const hasActions = action != null || visibility !== null;

  return (
    <section
      aria-label={section === 'decisions' ? 'Decision records' : label}
      data-context-section={section}
      data-context-card=""
      className="min-w-0 scroll-mt-3"
    >
      <Band inset="content" className="min-w-0">
        <SectionHeader
          label={label}
          headingLevel={2}
          meta={
            hasCount ? (
              <span data-context-count="" className="text-meta tabular-nums text-faint-foreground">
                {count}
              </span>
            ) : undefined
          }
          action={
            hasActions ? (
              <div className="flex shrink-0 items-center gap-1">
                {action}
                {onEdit !== undefined && onOpenVersions !== undefined ? (
                  <SlotSourceActions
                    label={label}
                    isLocked={isLocked}
                    historyCount={historyCount}
                    onEdit={onEdit}
                    onOpenVersions={onOpenVersions}
                    onToggleVisibility={() => setIsVisibilityOpen((isOpen) => !isOpen)}
                  />
                ) : visibility === null ? null : (
                  <span className="text-meta text-faint-foreground">{visibility.summary}</span>
                )}
              </div>
            ) : undefined
          }
        />
        {visibility === null ? null : (
          <Reveal id={panelId} open={isVisibilityOpen}>
            <ContextVisibility visibility={visibility} />
          </Reveal>
        )}
        {children}
      </Band>
    </section>
  );
};
