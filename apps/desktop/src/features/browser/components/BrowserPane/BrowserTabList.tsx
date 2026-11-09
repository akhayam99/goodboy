import { Plus } from 'lucide-react';
import { ICON_SIZE, ScrollFade, SectionLabel, SelectableRow } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';
import { BrowserTabRow } from './BrowserTabRow';

type Props = {
  readonly model: BrowserPaneModel;
};

export const BrowserTabList = ({ model }: Props) => {
  const shownId = model.shown?.tab.id ?? null;
  return (
    <nav aria-label="Browser tabs" className="flex w-48 shrink-0 flex-col gap-3">
      <ScrollFade
        className="min-h-0 flex-1"
        fadeFrom="subtle"
        viewportClassName="flex flex-col gap-4"
      >
        <section className="flex flex-col gap-1">
          <SectionLabel label="This session" />
          <div className="flex flex-col gap-0.5">
            {model.tabs.map((tab) => (
              <BrowserTabRow
                key={tab.id}
                label={model.titleOf({ tab })}
                url={tab.url}
                isSelected={tab.id === shownId}
                isPin={false}
                onSelect={() => model.select({ tab })}
                onClose={() => model.close({ tab })}
              />
            ))}
            <SelectableRow
              selected={model.isDrafting}
              onClick={model.startDraft}
              className="h-7 items-center gap-2 px-2"
            >
              <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="text-row">New tab</span>
            </SelectableRow>
          </div>
        </section>
        {model.pins.length === 0 || model.projectName === null ? null : (
          <section className="flex flex-col gap-1">
            <SectionLabel label={`Pinned for ${model.projectName}`} />
            <div className="flex flex-col gap-0.5">
              {model.pins.map((pin) => (
                <BrowserTabRow
                  key={pin.id}
                  label={model.titleOf({ tab: pin })}
                  url={pin.url}
                  isSelected={pin.id === shownId}
                  isPin
                  onSelect={() => model.select({ tab: pin })}
                />
              ))}
            </div>
          </section>
        )}
      </ScrollFade>
      <p className="text-meta text-faint-foreground">Tabs close when the session is archived.</p>
    </nav>
  );
};
