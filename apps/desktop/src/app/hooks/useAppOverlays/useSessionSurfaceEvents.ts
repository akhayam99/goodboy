import { useEffect } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { openPlanAnywhere } from '../../../features/plans/openPlanAnywhere';
import { sessionPlace, useAppStore } from '../../../store';
import { eventSessionId, eventValue, isPlanId } from './eventDetail';

type Params = {
  readonly close: () => void;
  readonly currentSession: Session | null;
  readonly currentWorkspace: Workspace | null;
  readonly isSessionSidebarCollapsed: boolean;
  readonly pinSessionSidebar: () => void;
};

type Listener = readonly [string, (event: Event) => void];

export const useSessionSurfaceEvents = ({
  close,
  currentSession,
  currentWorkspace,
  isSessionSidebarCollapsed,
  pinSessionSidebar,
}: Params) => {
  useEffect(() => {
    const openNewDrawer = (event: Event) => {
      const sessionId = eventSessionId(event) ?? useAppStore.getState().currentSessionId;
      if (sessionId === null) {
        return;
      }
      close();
      const state = useAppStore.getState();
      if (state.currentSessionId !== sessionId) {
        state.navigate({
          to: sessionPlace({ sessionId, lens: state.activeLens[sessionId] ?? null }),
        });
      }
      const form = eventValue({ event, key: 'form' }) === 'orchestrate' ? 'orchestrate' : 'run';
      useAppStore.getState().openDrawer({ kind: 'new', sessionId, payload: { form } });
    };
    const openPlanStudio = (event: Event) => {
      const sessionId = eventSessionId(event);
      if (sessionId === null) {
        return;
      }
      const planId = eventValue({ event, key: 'planId' });
      close();
      if (isPlanId(planId)) {
        openPlanAnywhere({ sessionId, planId });
        return;
      }
      useAppStore.getState().navigate({
        to: sessionPlace({ sessionId, lens: 'plans', target: null }),
      });
    };
    const listeners: ReadonlyArray<Listener> = [
      ['goodboy:open-plan-studio', openPlanStudio],
      ['goodboy:reveal-chat', () => close()],
      ['goodboy:open-workflow-builder', openNewDrawer],
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
      if (currentSession !== null && isSessionSidebarCollapsed) {
        pinSessionSidebar();
      }
    };
    window.addEventListener('goodboy:new-session', onNewSession);
    return () => window.removeEventListener('goodboy:new-session', onNewSession);
  }, [close, currentSession, currentWorkspace, isSessionSidebarCollapsed, pinSessionSidebar]);
};
