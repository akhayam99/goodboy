import { Plus } from 'lucide-react';
import { Button, ICON_SIZE, RevealRegion, ScrollFade, SectionLabel } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { hostOf } from '../../hostOf';
import type { BrowserPageGroup, BrowserPaneModel } from '../../types';
import { BrowserTabRow } from '../BrowserPane/BrowserTabRow';

type PickParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

type Props = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly sessionId: SessionId;
  readonly model: BrowserPaneModel;
  readonly onPick: (params: PickParams) => void;
};

type LabelParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

export const BrowserPageRail = ({ groups, sessionId, model, onPick }: Props) => {
  const shownId = model.shown?.tab.id ?? null;
  const labelOf = ({ group, tab }: LabelParams): string => {
    if (group.sessionId === sessionId) {
      return model.titleOf({ tab });
    }
    return tab.title === '' ? hostOf({ url: tab.url }) : tab.title;
  };
  const bindings = useAppStore(
    useShallow((state) => groups.map((group) => state.browserLiveTabs[group.sessionId])),
  );
  return (
    <nav aria-label="Tabs by session" className="flex min-h-0 flex-1 flex-col px-2 pt-2">
      <RevealRegion
        header={
          <div className="flex min-w-0 flex-col pb-2">
            <Button
              variant="secondary"
              aria-pressed={model.isDrafting}
              className="min-w-0 justify-start"
              onClick={model.startDraft}
            >
              <Plus size={ICON_SIZE.control} aria-hidden />
              New tab
            </Button>
          </div>
        }
      >
        <ScrollFade viewportClassName="flex flex-col gap-4 pb-2">
          {groups.map((group, index) => {
            const isHere = group.sessionId === sessionId;
            return (
              <section
                key={group.key}
                aria-label={group.label}
                data-browser-group={group.isPins ? 'pins' : 'session'}
                className="flex flex-col gap-1"
              >
                <SectionLabel
                  label={group.label}
                  headingLevel={2}
                  {...(group.tabs.length > 1 && { count: group.tabs.length })}
                />
                <div className="flex flex-col gap-0.5">
                  {group.tabs.map((tab) => (
                    <BrowserTabRow
                      key={tab.id}
                      label={labelOf({ group, tab })}
                      url={tab.url}
                      isSelected={isHere && tab.id === shownId}
                      isPin={group.isPins}
                      isAsleep={model.isLiveAsleep({ liveId: bindings[index]?.[tab.id] })}
                      onSelect={() => onPick({ group, tab })}
                      {...(isHere && !group.isPins && { onClose: () => model.close({ tab }) })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </ScrollFade>
      </RevealRegion>
    </nav>
  );
};
