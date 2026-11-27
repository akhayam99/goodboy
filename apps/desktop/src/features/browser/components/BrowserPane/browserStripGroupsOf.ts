import type { BrowserTab } from '../../../../store/slices/browser/types';
import { hostOf } from '../../hostOf';
import type { BrowserPageGroup, BrowserPaneModel } from '../../types';

type PickParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

type FoldedParams = {
  readonly folded: ReadonlySet<string>;
};

export type BrowserStripGroups = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly onPick: (params: PickParams) => void;
  readonly folded: ReadonlySet<string>;
  readonly onFoldedChange: (params: FoldedParams) => void;
};

export type StripTab = {
  readonly tab: BrowserTab;
  readonly label: string;
  readonly isPin: boolean;
  readonly isAsleep: boolean;
  readonly isShown: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

export type StripGroup = {
  readonly key: string;
  readonly label: string | null;
  readonly isPins: boolean;
  readonly tabs: ReadonlyArray<StripTab>;
};

type Bindings = ReadonlyArray<Readonly<Record<string, string>> | undefined>;

type Params = {
  readonly model: BrowserPaneModel;
  readonly page?: BrowserStripGroups;
  readonly bindings: Bindings;
};

type GroupsParams = {
  readonly model: BrowserPaneModel;
  readonly page: BrowserStripGroups;
  readonly bindings: Bindings;
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

export const browserStripGroupsOf = ({
  model,
  page,
  bindings,
}: Params): ReadonlyArray<StripGroup> => {
  if (page === undefined) {
    return paneGroupsOf({ model });
  }
  return page.groups.map((group, index) => ({
    key: group.key,
    label: group.label,
    isPins: group.isPins,
    tabs: itemsOf({ model, page, bindings, group, index }),
  }));
};
