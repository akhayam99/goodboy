import { Plus } from 'lucide-react';
import { IconButton, ScrollFade } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';
import { BrowserTabChip } from './BrowserTabChip';

type Props = {
  readonly model: BrowserPaneModel;
};

export const BrowserTabStrip = ({ model }: Props) => {
  const shownId = model.shown?.tab.id ?? null;
  return (
    <div className="flex shrink-0 items-center gap-1 px-3">
      <ScrollFade
        orientation="horizontal"
        className="min-w-0 shrink"
        viewportClassName="flex items-center"
      >
        <nav aria-label="Browser tabs" className="flex items-center gap-1">
          {model.tabs.map((tab) => (
            <BrowserTabChip
              key={tab.id}
              label={model.titleOf({ tab })}
              url={tab.url}
              isSelected={tab.id === shownId}
              isPin={false}
              onSelect={() => model.select({ tab })}
              onClose={() => model.close({ tab })}
            />
          ))}
          {model.pins.length > 0 && model.tabs.length > 0 ? (
            <span
              role="separator"
              aria-orientation="vertical"
              className="h-4 w-px shrink-0 bg-border-soft"
            />
          ) : null}
          {model.pins.map((pin) => (
            <BrowserTabChip
              key={pin.id}
              label={model.titleOf({ tab: pin })}
              url={pin.url}
              isSelected={pin.id === shownId}
              isPin
              onSelect={() => model.select({ tab: pin })}
            />
          ))}
        </nav>
      </ScrollFade>
      <IconButton
        icon={Plus}
        label="New tab"
        shortcut="browser.newTab"
        size="xs"
        variant="ghost"
        tooltipSide="top"
        onClick={model.startDraft}
      />
    </div>
  );
};
