import { useEffect } from 'react';
import { IMPACT_STUDIO_EVENT } from '../../../features/impact/openImpactStudio';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../../features/notifications/studioEvent';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../features/onboarding/openCommandPaletteEvent';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../../features/settings/reportIssueStudioEvent';
import { useAppStore } from '../../../store';
import {
  eventValue,
  impactOverlayFromEvent,
  inboxOverlayFromEvent,
  isWorkspaceId,
  settingsOverlayFromEvent,
} from './eventDetail';
import type { Overlay } from './overlayState';

type Params = {
  readonly open: (params: { readonly overlay: Overlay }) => void;
  readonly close: () => void;
  readonly openPalette: () => void;
};

type Listener = readonly [string, (event: Event) => void];

export const useStudioEvents = ({ open, close, openPalette }: Params) => {
  useEffect(() => {
    const openInbox = (event: Event) => {
      const overlay = inboxOverlayFromEvent(event);
      const openStudio = () => open({ overlay });
      const workspaceId = eventValue({ event, key: 'workspaceId' });
      if (isWorkspaceId(workspaceId) && workspaceId !== useAppStore.getState().currentWorkspaceId) {
        close();
        void useAppStore.getState().setCurrentWorkspace(workspaceId).then(openStudio, openStudio);
        return;
      }
      openStudio();
    };
    const listeners: ReadonlyArray<Listener> = [
      ['goodboy:open-settings', (event) => open({ overlay: settingsOverlayFromEvent(event) })],
      ['goodboy:open-guide', () => open({ overlay: { kind: 'guide' } })],
      [REPORT_ISSUE_STUDIO_EVENT, () => open({ overlay: { kind: 'report' } })],
      [NOTIFICATIONS_STUDIO_EVENT, () => open({ overlay: { kind: 'notifications' } })],
      [IMPACT_STUDIO_EVENT, (event) => open({ overlay: impactOverlayFromEvent(event) })],
      ['goodboy:open-inbox', openInbox],
      ['goodboy:add-workspace', () => open({ overlay: { kind: 'addWorkspace' } })],
      ['goodboy:open-pair-device', () => open({ overlay: { kind: 'companion' } })],
      ['goodboy:open-workflow-studio', () => open({ overlay: { kind: 'workflow' } })],
      [OPEN_COMMAND_PALETTE_EVENT, () => openPalette()],
    ];
    listeners.forEach(([name, listener]) => window.addEventListener(name, listener));
    return () =>
      listeners.forEach(([name, listener]) => window.removeEventListener(name, listener));
  }, [close, open, openPalette]);
};
