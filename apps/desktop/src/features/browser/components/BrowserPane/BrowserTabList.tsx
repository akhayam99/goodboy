import { ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import {
  FOCUS_RING,
  ICON_SIZE,
  IconButton,
  ScrollFade,
  SectionLabel,
  SelectableRow,
  Tooltip,
  cn,
} from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';
import { BrowserTabRow } from './BrowserTabRow';

type Props = {
  readonly model: BrowserPaneModel;
  readonly isRail: boolean;
  readonly canFold: boolean;
  readonly onFold: () => void;
};

const SESSION_NOTE = 'Tabs close when the session is archived.';

export const BrowserTabList = ({ model, isRail, canFold, onFold }: Props) => {
  const shownId = model.shown?.tab.id ?? null;
  const hasPins = model.pins.length > 0 && model.projectName !== null;
  return (
    <nav
      aria-label="Browser tabs"
      data-tab-list={isRail ? 'rail' : 'list'}
      className={cn('flex shrink-0 flex-col gap-2', isRail ? 'w-9' : 'w-48')}
    >
      <ScrollFade
        className="min-h-0 flex-1"
        fadeFrom="subtle"
        viewportClassName={cn('flex flex-col', isRail ? 'gap-3' : 'gap-4')}
      >
        {hasPins ? (
          <section className="flex flex-col gap-1">
            {isRail ? null : <SectionLabel label={`Pinned · ${model.projectName}`} />}
            <div className="flex flex-col gap-0.5">
              {model.pins.map((pin) => (
                <BrowserTabRow
                  key={pin.id}
                  label={model.titleOf({ tab: pin })}
                  url={pin.url}
                  isSelected={pin.id === shownId}
                  isPin
                  isAsleep={model.isAsleep({ tab: pin })}
                  isCompact={isRail}
                  onSelect={() => model.select({ tab: pin })}
                />
              ))}
            </div>
          </section>
        ) : null}
        <section className="flex flex-col gap-1">
          {isRail ? null : (
            <Tooltip content={SESSION_NOTE} side="right">
              <span tabIndex={0} className={cn('flex min-w-0 rounded-sm', FOCUS_RING)}>
                <SectionLabel label="This session" />
              </span>
            </Tooltip>
          )}
          <div className="flex flex-col gap-0.5">
            {model.tabs.map((tab) => (
              <BrowserTabRow
                key={tab.id}
                label={model.titleOf({ tab })}
                url={tab.url}
                isSelected={tab.id === shownId}
                isPin={false}
                isAsleep={model.isAsleep({ tab })}
                isCompact={isRail}
                onSelect={() => model.select({ tab })}
                onClose={() => model.close({ tab })}
              />
            ))}
            <SelectableRow
              selected={model.isDrafting}
              onClick={model.startDraft}
              title={isRail ? 'New tab' : undefined}
              tooltipSide="right"
              className={cn('h-7 items-center gap-2 px-2', isRail && 'justify-center px-0')}
            >
              <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              {isRail ? (
                <span className="sr-only">New tab</span>
              ) : (
                <span className="text-row">New tab</span>
              )}
            </SelectableRow>
          </div>
        </section>
      </ScrollFade>
      {canFold ? (
        <div className={cn('flex', isRail ? 'justify-center' : 'justify-end')}>
          <IconButton
            icon={isRail ? ChevronsRight : ChevronsLeft}
            label={isRail ? 'Expand tab list' : 'Fold tab list'}
            variant="ghost"
            size="xs"
            tooltipSide="right"
            onClick={onFold}
          />
        </div>
      ) : null}
    </nav>
  );
};
