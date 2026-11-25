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
  readonly folded: ReadonlySet<string>;
  readonly onFoldedChange: (params: FoldedParams) => void;
};

type FoldedParams = {
  readonly folded: ReadonlySet<string>;
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
  readonly isPins: boolean;
  readonly tabs: ReadonlyArray<StripTab>;
};

type TabNodeParams = {
  readonly item: StripTab;
};

type GroupNodeParams = {
  readonly group: StripGroup;
  readonly hasSeparator: boolean;
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

const NO_GROUPS: ReadonlyArray<BrowserPageGroup> = [];

const labelOf = ({ model, tab, isHere }: LabelParams): string => {
  if (isHere) {
    return model.titleOf({ tab });
  }
  return tab.title === '' ? hostOf({ url: tab.url }) : tab.title;
};

const paneGroupsOf = ({ model }: ModelParams): ReadonlyArray<StripGroup> => {
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
  const pinLabel = model.projectName === null ? null : `Pinned · ${model.projectName}`;
  return [
    ...(pins.length > 0 ? [{ key: 'pins', label: pinLabel, isPins: true, tabs: pins }] : []),
    { key: 'session', label: null, isPins: false, tabs },
  ];
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

const pageGroupsOf = ({ model, page, bindings }: GroupsParams): ReadonlyArray<StripGroup> =>
  page.groups.map((group, index) => ({
    key: group.key,
    label: group.label,
    isPins: group.isPins,
    tabs: itemsOf({ model, page, bindings, group, index }),
  }));

const GROUP_DIVIDER = (
  <span role="separator" aria-orientation="vertical" className="h-4 w-px shrink-0 bg-border-soft" />
);

export const BrowserTabStrip = ({ model, field, page }: Props) => {
  const [paneFolded, setPaneFolded] = useState<ReadonlySet<string>>(() => new Set());
  const folded = page?.folded ?? paneFolded;
  const setFolded = ({ folded: next }: FoldedParams): void => {
    if (page === undefined) {
      setPaneFolded(next);
      return;
    }
    page.onFoldedChange({ folded: next });
  };
  const viewport = useRef<HTMLDivElement | null>(null);
  const pageGroups = page?.groups ?? NO_GROUPS;
  const bindings = useAppStore(
    useShallow((state) => pageGroups.map((group) => state.browserLiveTabs[group.sessionId])),
  );
  const shownId = model.shown?.tab.id ?? null;
  const all =
    page === undefined ? paneGroupsOf({ model }) : pageGroupsOf({ model, page, bindings });
  const pinGroups = all.filter((group) => group.isPins);
  const tabGroups = all.filter((group) => !group.isPins);
  const isPaged = page !== undefined;
  const hasTabs = tabGroups.some((group) => isPaged || group.tabs.length > 0);

  useEffect(() => {
    const target = field.isFieldShown
      ? field.fieldRef.current
      : viewport.current?.querySelector('[data-browser-tab="active"]');
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [shownId, field.isFieldShown, field.fieldRef]);

  const toggle = ({ key }: FoldParams): void => {
    const next = new Set(folded);
    if (next.has(key)) {
      next.delete(key);
      setFolded({ folded: next });
      return;
    }
    next.add(key);
    setFolded({ folded: next });
  };

  const tabNode = ({ item }: TabNodeParams): ReactNode => {
    return (
      <ObjectMenuArea
        key={item.tab.id}
        target={browserTabTargetOf({ model, tab: item.tab })}
        anchorKey={`browser-tab:${item.tab.id}`}
      >
        {item.isShown ? (
          <BrowserAddressPill model={model} field={field} onClose={item.onClose} />
        ) : (
          <BrowserTabChip
            label={item.label}
            url={item.tab.url}
            isPin={item.isPin}
            isAsleep={item.isAsleep}
            onSelect={item.onSelect}
          />
        )}
      </ObjectMenuArea>
    );
  };

  const groupNode = ({ group, hasSeparator }: GroupNodeParams): ReactNode => {
    const isFolded = folded.has(group.key);
    const canFold = isPaged && !group.isPins && group.label !== null;
    const shownTabs = isFolded ? group.tabs.filter((item) => item.isShown) : group.tabs;
    return (
      <div
        key={group.key}
        role="group"
        aria-label={group.label ?? undefined}
        data-browser-group={group.isPins ? 'pins' : 'session'}
        className="contents"
      >
        {hasSeparator ? GROUP_DIVIDER : null}
        {canFold && group.label !== null ? (
          <BrowserTabGroupLabel
            label={group.label}
            count={group.tabs.length}
            isFolded={isFolded}
            onToggle={() => toggle({ key: group.key })}
          />
        ) : null}
        {shownTabs.map((item) => tabNode({ item }))}
      </div>
    );
  };

  return (
    <>
      <ScrollFade
        orientation="horizontal"
        viewportRef={viewport}
        className="h-full min-w-0 flex-1"
        viewportClassName="flex items-center gap-0.5"
      >
        <nav aria-label="Browser tabs" className="contents">
          {pinGroups.map((group) => groupNode({ group, hasSeparator: false }))}
          {tabGroups.map((group, index) =>
            groupNode({ group, hasSeparator: hasTabs && (index > 0 || pinGroups.length > 0) }),
          )}
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
