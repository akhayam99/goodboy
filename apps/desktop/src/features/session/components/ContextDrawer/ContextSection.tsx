import { useId, useState, type ReactNode } from 'react';
import { Band, Reveal } from '@goodboy/ui';
import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';
import { CONTEXT_SECTION_LABEL } from './contextSections';
import { CONTEXT_CARD_BODY } from './contextCardBody';
import { ContextCardHead } from './ContextCardHead';
import { ContextVisibility } from './ContextVisibility';
import { SlotSourceActions } from './SlotSourceActions';
import type { Visibility } from './roleVisibility';

type Props = {
  readonly section: ContextDrawerSection;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly visibility?: Visibility | null;
  readonly layout?: keyof typeof CONTEXT_CARD_BODY;
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
  layout = 'prose',
  children,
  isLocked = false,
  historyCount = 0,
  onEdit,
  onOpenVersions,
}: Props) => {
  const panelId = useId();
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const label = CONTEXT_SECTION_LABEL[section];
  const hasSourceActions = onEdit !== undefined && onOpenVersions !== undefined;
  const hasActions = action != null || visibility !== null;

  return (
    <section
      aria-label={section === 'decisions' ? 'Decision records' : label}
      data-context-section={section}
      data-context-block={section}
      data-context-card=""
      className="min-w-0 scroll-mt-3"
    >
      <Band className="min-w-0">
        <ContextCardHead
          label={label}
          count={count}
          actions={
            hasActions ? (
              <>
                {action}
                {hasSourceActions ? (
                  <SlotSourceActions
                    label={label}
                    isLocked={isLocked}
                    historyCount={historyCount}
                    onEdit={onEdit}
                    onOpenVersions={onOpenVersions}
                    onToggleVisibility={() => setIsVisibilityOpen((isOpen) => !isOpen)}
                  />
                ) : visibility === null ? null : (
                  <span className="px-1 text-meta text-faint-foreground">{visibility.summary}</span>
                )}
              </>
            ) : undefined
          }
        />
        {visibility === null ? null : (
          <Reveal id={panelId} open={isVisibilityOpen}>
            <div className={CONTEXT_CARD_BODY.prose}>
              <ContextVisibility visibility={visibility} />
            </div>
          </Reveal>
        )}
        <div className={CONTEXT_CARD_BODY[layout]}>{children}</div>
      </Band>
    </section>
  );
};
