import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from '@goodboy/ui/icons';
import { IconButton, ScrollFade } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import type { CommandField } from '../../hooks/useCommandField';
import { hostOf } from '../../hostOf';
import type { BrowserPageGroup, BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserTabChip } from './BrowserTabChip';
import { BrowserTabGroupLabel } from './BrowserTabGroupLabel';
import { browserTabTargetOf } from './browserTabTargetOf';

type PickParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

export type BrowserStripGroups = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly onPick: (params: PickParams) => void;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly field: CommandField;
  readonly page?: BrowserStripGroups;
};

type StripTab = {
  readonly tab: BrowserTab;
  readonly label: string;
  readonly isPin: boolean;
  readonly isAsleep: boolean;
  readonly isShown: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

type StripGroup = {
  readonly key: string;
  readonly label: string | null;
  readonly tabs: ReadonlyArray<StripTab>;
};

type TabNodeParams = {
  readonly item: StripTab;
};

type GroupsParams = {
  readonly model: BrowserPaneModel;
  readonly page: BrowserStripGroups;
  readonly bindings: ReadonlyArray<Readonly<Record<string, string>> | undefined>;
};

type FoldParams = {
  readonly key: string;
};

type ModelParams = {
  readonly model: BrowserPaneModel;
};

type ItemsParams = GroupsParams & {
  readonly group: BrowserPageGroup;
  readonly index: number;
};

type LabelParams = ModelParams & {
  readonly tab: BrowserTab;
  readonly isHere: boolean;
};

type StripTabs = {
  readonly pins: ReadonlyArray<StripTab>;
  readonly groups: ReadonlyArray<StripGroup>;
};

const NO_GROUPS: ReadonlyArray<BrowserPageGroup> = [];

const labelOf = ({ model, tab, isHere }: LabelParams): string => {
  if (isHere) {
    return model.titleOf({ tab });
  }
  return tab.title === '' ? hostOf({ url: tab.url }) : tab.title;
};

const paneTabsOf = ({ model }: ModelParams): StripTabs => {
  const shownId = model.shown?.tab.id ?? null;
  const pins = model.pins.map((pin): StripTab => ({
    tab: pin,
    label: model.titleOf({ tab: pin }),
    isPin: true,
    isAsleep: model.isAsleep({ tab: pin }),
    isShown: pin.id === shownId,
    onSelect: () => model.select({ tab: pin }),
  }));
  const tabs = model.tabs.map((tab): StripTab => ({
    tab,
    label: model.titleOf({ tab }),
    isPin: false,
    isAsleep: model.isAsleep({ tab }),
    isShown: tab.id === shownId,
    onSelect: () => model.select({ tab }),
    onClose: () => model.close({ tab }),
  }));
  const groups: ReadonlyArray<StripGroup> = [{ key: 'session', label: null, tabs }];
  return { pins, groups };
};

const itemsOf = ({ model, page, bindings, group, index }: ItemsParams): ReadonlyArray<StripTab> => {
  const isHere = group.sessionId === model.sessionId;
  const shownId = model.shown?.tab.id ?? null;
  return group.tabs.map((tab) => ({
    tab,
    label: labelOf({ model, tab, isHere }),
    isPin: group.isPins,
    isAsleep: model.isLiveAsleep({ liveId: bindings[index]?.[tab.id] }),
    isShown: isHere && tab.id === shownId,
    onSelect: () => page.onPick({ group, tab }),
    ...(isHere && !group.isPins && { onClose: () => model.close({ tab }) }),
  }));
};

const pageTabsOf = ({ model, page, bindings }: GroupsParams): StripTabs => {
  const pins = page.groups.flatMap((group, index) =>
    group.isPins ? itemsOf({ model, page, bindings, group, index }) : [],
  );
  const groups = page.groups.flatMap((group, index): ReadonlyArray<StripGroup> =>
    group.isPins
      ? []
      : [
          {
            key: group.key,
            label: group.label,
            tabs: itemsOf({ model, page, bindings, group, index }),
          },
        ],
  );
  return { pins, groups };
};

export const BrowserTabStrip = ({ model, field, page }: Props) => {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const viewport = useRef<HTMLDivElement | null>(null);
  const pageGroups = page?.groups ?? NO_GROUPS;
  const bindings = useAppStore(
    useShallow((state) => pageGroups.map((group) => state.browserLiveTabs[group.sessionId])),
  );
  const shownId = model.shown?.tab.id ?? null;
  const { pins, groups } =
    page === undefined ? paneTabsOf({ model }) : pageTabsOf({ model, page, bindings });

  useEffect(() => {
    viewport.current
      ?.querySelector('[data-browser-tab="active"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [shownId]);

  const toggle = ({ key }: FoldParams): void => {
    const next = new Set(folded);
    if (next.has(key)) {
      next.delete(key);
      setFolded(next);
      return;
    }
    next.add(key);
    setFolded(next);
  };

  const tabNode = ({ item }: TabNodeParams): ReactNode => {
    if (item.isShown) {
      return <BrowserAddressPill key={item.tab.id} model={model} field={field} />;
    }
    return (
      <ObjectMenuArea
        key={item.tab.id}
        target={browserTabTargetOf({ model, tab: item.tab })}
        anchorKey={`browser-tab:${item.tab.id}`}
      >
        <BrowserTabChip
          label={item.label}
          url={item.tab.url}
          isPin={item.isPin}
          isAsleep={item.isAsleep}
          onSelect={item.onSelect}
          onClose={item.onClose}
        />
      </ObjectMenuArea>
    );
  };

  const hasTabs = groups.some((group) => group.tabs.length > 0 || group.label !== null);

  return (
    <>
      <ScrollFade
        orientation="horizontal"
        viewportRef={viewport}
        className="h-full min-w-0 flex-1"
        viewportClassName="flex items-center gap-0.5"
      >
        <nav aria-label="Browser tabs" className="contents">
          {pins.map((item) => tabNode({ item }))}
          {pins.length > 0 && hasTabs ? (
            <span
              role="separator"
              aria-orientation="vertical"
              className="h-4 w-px shrink-0 bg-border-soft"
            />
          ) : null}
          {groups.map((group, index) => {
            const isFolded = folded.has(group.key);
            const shownTabs = isFolded ? group.tabs.filter((item) => item.isShown) : group.tabs;
            return (
              <div
                key={group.key}
                role="group"
                aria-label={group.label ?? undefined}
                className="contents"
              >
                {index > 0 ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="h-4 w-px shrink-0 bg-border-soft"
                  />
                ) : null}
                {group.label === null ? null : (
                  <BrowserTabGroupLabel
                    label={group.label}
                    count={group.tabs.length}
                    isFolded={isFolded}
                    onToggle={() => toggle({ key: group.key })}
                  />
                )}
                {shownTabs.map((item) => tabNode({ item }))}
              </div>
            );
          })}
          {model.shown === null ? <BrowserAddressPill model={model} field={field} /> : null}
        </nav>
      </ScrollFade>
      {model.shown === null ? null : (
        <IconButton
          icon={Plus}
          label="New tab"
          shortcut="browser.newTab"
          tooltipSide="top"
          onClick={model.startDraft}
        />
      )}
    </>
  );
};
