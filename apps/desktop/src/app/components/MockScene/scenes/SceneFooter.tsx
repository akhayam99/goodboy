import { AppFooter } from '../../AppFooter';
import type {
  ConnectedIntegrations,
  FooterTarget,
} from '../../../hooks/useAppOverlays/overlayState';
import type { ShellFooterScope } from '../../../shellArrangement';
import { SCENE_CONNECTED } from './sceneShell';

const noop = () => undefined;

type Props = {
  readonly scope: ShellFooterScope;
  readonly target?: FooterTarget;
  readonly connected?: ConnectedIntegrations;
};

export const SceneFooter = ({
  scope,
  target = { place: null, tool: null },
  connected = SCENE_CONNECTED,
}: Props) => (
  <AppFooter
    scope={scope}
    target={target}
    connected={connected}
    onOpenIntegration={noop}
    onOpenInbox={noop}
    onOpenWorkflows={noop}
    onOpenImpact={noop}
    onOpenSettings={noop}
    onOpenShortcuts={noop}
    onOpenChangelog={noop}
    onOpenGuide={noop}
  />
);
