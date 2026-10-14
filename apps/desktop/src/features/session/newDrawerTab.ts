import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';
import type { NewDrawerTab } from '../../store/slices/drawer/state';

const NEW_DRAWER_TABS: ReadonlyArray<NewDrawerTab> = ['run', 'agent', 'write'];

const FIRST_TAB: NewDrawerTab = 'run';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly tab: NewDrawerTab;
};

const isNewDrawerTab = (value: unknown): value is NewDrawerTab =>
  NEW_DRAWER_TABS.some((candidate) => candidate === value);

const tabPref = ({ workspaceId }: Params) =>
  persistedPref<NewDrawerTab>({
    key: `${STORAGE_PREFIXES.newDrawerTab}${workspaceId}`,
    parse: (raw) => (isNewDrawerTab(raw) ? raw : undefined),
    serialize: (tab) => tab,
    fallback: FIRST_TAB,
  });

export const readLastNewTab = ({ workspaceId }: Params): NewDrawerTab =>
  tabPref({ workspaceId }).read();

export const writeLastNewTab = ({ workspaceId, tab }: WriteParams): void =>
  tabPref({ workspaceId }).write(tab);
