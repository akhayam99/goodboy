import { useEffect } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { SessionStudio } from '../../../store/slices/session-view/types';
import { clearCurrentSessionStudio } from './clearCurrentSessionStudio';
import { eventSessionId, eventValue, isPlanId } from './eventDetail';

type Params = {
  readonly close: () => void;
  readonly currentSession: Session | null;
  readonly currentWorkspace: Workspace | null;
  readonly isSessionSidebarCollapsed: boolean;
  readonly pinSessionSidebar: () => void;
};

type Listener = readonly [string, (event: Event) => void];

type SessionStudioParams = {
  readonly event: Event;
  readonly studio: SessionStudio;
};

export const useSessionSurfaceEvents = ({
  close,
  currentSession,
  currentWorkspace,
  isSessionSidebarCollapsed,
  pinSessionSidebar,
}: Params) => {
  useEffect(() => {
    const openSessionStudio = ({ event, studio }: SessionStudioParams) => {
      const sessionId = eventSessionId(event);
      if (sessionId === null) {
        return;
      }
      close();
      useAppStore.getState().setSessionStudio(sessionId, studio);
    };
    const openPlanStudio = (event: Event) => {
      const sessionId = eventSessionId(event);
      if (sessionId === null) {
        return;
      }
      const planId = eventValue({ event, key: 'planId' });
      close();
      const state = useAppStore.getState();
      state.setFocusedPlanId(sessionId, isPlanId(planId) ? planId : null);
      state.setActiveLens(sessionId, 'plans');
    };
    const listeners: ReadonlyArray<Listener> = [
      ['goodboy:open-plan-studio', openPlanStudio],
      [
        'goodboy:reveal-chat',
        () => {
          close();
          clearCurrentSessionStudio();
        },
      ],
      ['goodboy:open-gitlab-mr', (event) => openSessionStudio({ event, studio: { kind: 'mr' } })],
      [
        'goodboy:open-bitbucket-pr',
        (event) => openSessionStudio({ event, studio: { kind: 'bitbucket' } }),
      ],
      [
        'goodboy:open-workflow-builder',
        (event) => openSessionStudio({ event, studio: { kind: 'workflow' } }),
      ],
    ];
    listeners.forEach(([name, listener]) => window.addEventListener(name, listener));
    return () =>
      listeners.forEach(([name, listener]) => window.removeEventListener(name, listener));
  }, [close]);

  useEffect(() => {
    const onNewSession = () => {
      if (currentWorkspace === null) {
        return;
      }
      close();
      clearCurrentSessionStudio();
      if (currentSession !== null && isSessionSidebarCollapsed) {
        pinSessionSidebar();
      }
    };
    window.addEventListener('goodboy:new-session', onNewSession);
    return () => window.removeEventListener('goodboy:new-session', onNewSession);
  }, [close, currentSession, currentWorkspace, isSessionSidebarCollapsed, pinSessionSidebar]);
};
