import { useId, useState, type ReactNode } from 'react';
import { Band, Reveal, SectionHeader } from '@goodboy/ui';
import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';
import { CONTEXT_TAB_LABEL } from './contextTabs';
import { ContextVisibility } from './ContextVisibility';
import { ContextVisibilityToggle } from './ContextVisibilityToggle';
import type { Visibility } from './roleVisibility';

const COUNT_FLOOR = 2;

type Props = {
  readonly section: ContextDrawerTab;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly visibility?: Visibility | null;
  readonly children: ReactNode;
};

export const ContextSection = ({ section, count, action, visibility = null, children }: Props) => {
  const panelId = useId();
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const label = CONTEXT_TAB_LABEL[section];
  const hasCount = count !== undefined && count >= COUNT_FLOOR;
  const hasActions = (action !== undefined && action !== null) || visibility !== null;

  return (
    <section
      aria-label={label}
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
                {visibility === null ? null : (
                  <ContextVisibilityToggle
                    visibility={visibility}
                    isOpen={isVisibilityOpen}
                    panelId={panelId}
                    onToggle={() => setIsVisibilityOpen((isOpen) => !isOpen)}
                  />
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
