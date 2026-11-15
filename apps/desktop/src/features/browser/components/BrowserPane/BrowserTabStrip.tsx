import { ToolTabStrip } from '../../../../shared/components/ToolTabStrip';
import type { BrowserPaneModel } from '../../types';
import { BrowserTabChip } from './BrowserTabChip';

type Props = {
  readonly model: BrowserPaneModel;
};

export const BrowserTabStrip = ({ model }: Props) => {
  const shownId = model.shown?.tab.id ?? null;
  return (
    <ToolTabStrip
      newLabel="New tab"
      newShortcut="browser.newTab"
      onNew={model.startDraft}
      isUnderHead
    >
      <nav aria-label="Browser tabs" className="flex w-full items-center gap-1">
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
    </ToolTabStrip>
  );
};
