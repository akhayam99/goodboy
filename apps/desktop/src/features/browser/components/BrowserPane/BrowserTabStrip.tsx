import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from '@goodboy/ui/icons';
import { IconButton, ScrollFade } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import type { CommandField } from '../../hooks/useCommandField';
import type { BrowserPageGroup, BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserTabChip } from './BrowserTabChip';
import { BrowserTabGroupLabel } from './BrowserTabGroupLabel';
import type { BrowserMenuTab } from './browserMenuTabsOf';
import {
  browserStripGroupsOf,
  type BrowserStripGroups,
  type StripGroup,
  type StripTab,
} from './browserStripGroupsOf';
import { browserTabTargetOf } from './browserTabTargetOf';

type FoldedParams = {
  readonly folded: ReadonlySet<string>;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly field: CommandField;
  readonly page?: BrowserStripGroups;
  readonly isNarrow: boolean;
};

type TabNodeParams = {
  readonly item: StripTab;
};

type GroupNodeParams = {
  readonly group: StripGroup;
  readonly hasSeparator: boolean;
};

type FoldParams = {
  readonly key: string;
};

type MenuTabsParams = {
  readonly groups: ReadonlyArray<StripGroup>;
};

const NO_GROUPS: ReadonlyArray<BrowserPageGroup> = [];

const NO_MENU_TABS: ReadonlyArray<BrowserMenuTab> = [];

const menuTabsOf = ({ groups }: MenuTabsParams): ReadonlyArray<BrowserMenuTab> =>
  groups.flatMap((group) =>
    group.tabs
      .filter((item) => !item.isShown)
      .map((item) => ({
        key: `${group.key}-${item.tab.id}`,
        label: item.label,
        onSelect: item.onSelect,
      })),
  );

const GROUP_DIVIDER = (
  <span role="separator" aria-orientation="vertical" className="h-4 w-px shrink-0 bg-border-soft" />
);

export const BrowserTabStrip = ({ model, field, page, isNarrow }: Props) => {
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
  const all = browserStripGroupsOf({ model, page, bindings });
  const pinGroups = all.filter((group) => group.isPins);
  const tabGroups = all.filter((group) => !group.isPins);
  const isPaged = page !== undefined;
  const hasTabs = tabGroups.some((group) => isPaged || group.tabs.length > 0);
  const menuTabs = isNarrow ? menuTabsOf({ groups: tabGroups }) : NO_MENU_TABS;

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
          <BrowserAddressPill
            model={model}
            field={field}
            isNarrow={isNarrow}
            menuTabs={menuTabs}
            onClose={item.onClose}
          />
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
    const isOnlyShown = isFolded || (isNarrow && !group.isPins);
    const canFold = isPaged && !isNarrow && !group.isPins && group.label !== null;
    const shownTabs = isOnlyShown ? group.tabs.filter((item) => item.isShown) : group.tabs;
    if (isNarrow && !group.isPins && shownTabs.length === 0) {
      return null;
    }
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
            groupNode({
              group,
              hasSeparator: hasTabs && ((index > 0 && !isNarrow) || pinGroups.length > 0),
            }),
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
