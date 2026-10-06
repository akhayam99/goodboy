import type { ColumnActions } from '../../SideColumn/columnDoors';
import type { ColumnPlace } from '../../SideColumn/columnPlace';
import type {
  ConnectedIntegrations,
  FooterTarget,
} from '../../../hooks/useAppOverlays/overlayState';
import type { ShellMode } from '../../../shellArrangement';
import { sceneParam } from './audit/sceneParams';

const noop = () => undefined;

export const SCENE_COLUMN_ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openSettings: noop,
  openChangelog: noop,
  openShortcuts: noop,
};

export const SCENE_CONNECTED: ConnectedIntegrations = {
  github: true,
  linear: true,
  jira: true,
  sentry: true,
  gitlab: false,
  bitbucket: false,
  slack: true,
};

export const sceneShellMode = (): ShellMode =>
  sceneParam({ key: 'bars' }) === 'classic' ? 'classic' : 'column';

export const sceneColumnPlace = ({ target }: { readonly target: FooterTarget }): ColumnPlace => {
  switch (target.place) {
    case 'inbox':
      return 'inbox';
    case 'workflows':
      return 'workflows';
    case 'settings':
      return 'settings';
    case 'impact':
      return 'impact';
    case 'link':
    case 'changelog':
    case null:
      return null;
    default: {
      const unreachable: never = target.place;
      return unreachable;
    }
  }
};
