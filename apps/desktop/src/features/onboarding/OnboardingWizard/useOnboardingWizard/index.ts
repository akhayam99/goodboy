import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, Workspace, WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import {
  ONBOARDING_PROGRESS_EVENT,
  OPEN_WIZARD_EVENT,
  getWizardState,
  getWizardStep,
  type OpenWizardDetail,
} from '../../onboarding-store';
import { resumeStep, type WizardMode, type WizardStepId } from '../wizardSteps';

export type OnboardingWizardState = {
  readonly isOpen: boolean;
  readonly mode: WizardMode;
  readonly start: WizardStepId | null;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
  readonly workspace: Workspace | null;
  readonly workspaceId: WorkspaceId | null;
  readonly projectCount: number;
  readonly projects: ReadonlyArray<Project>;
  readonly close: () => void;
};

export type WizardContext = Omit<OnboardingWizardState, 'isOpen' | 'close'>;

type Params = {
  readonly isMainWindow: boolean;
};

type Opening = {
  readonly mode: WizardMode;
  readonly start: WizardStepId | null;
};

const CLOSED: Opening | null = null;

export const useOnboardingWizard = ({ isMainWindow }: Params): OnboardingWizardState => {
  const providersConnected = useAppStore(
    (s) => s.providers.filter((p) => p.connection === 'connected').length,
  );
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const workspace =
    workspaces.find((candidate) => candidate.id === currentWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceId = workspace?.id ?? null;
  const projects = useAppStore(
    useShallow((state) => state.projects.filter((project) => project.workspaceId === workspaceId)),
  );
  const hasWorkspace = workspace !== null;
  const hydrated = useAppStore((s) => s.hydrated);

  const [opening, setOpening] = useState<Opening | null>(CLOSED);
  const isDecided = useRef(false);
  const isOpenRef = useRef(false);

  const show = useCallback((next: Opening) => {
    isDecided.current = true;
    isOpenRef.current = true;
    setOpening(next);
  }, []);

  const close = useCallback(() => {
    isDecided.current = true;
    isOpenRef.current = false;
    setOpening(CLOSED);
  }, []);

  useEffect(() => {
    if (!isMainWindow) {
      return;
    }
    const onOpen = (event: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as Partial<OpenWizardDetail> | null) : null;
      const mode = detail?.mode ?? 'full';
      if (mode !== 'full' && isOpenRef.current) {
        return;
      }
      show({ mode, start: detail?.step ?? null });
    };
    const onProgress = () => {
      if (getWizardState() === 'open' || !isOpenRef.current) {
        return;
      }
      close();
    };
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);
      window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    };
  }, [isMainWindow, show, close]);

  useEffect(() => {
    if (isDecided.current || !hydrated || !isMainWindow) {
      return;
    }
    if (getWizardState() !== 'open') {
      return;
    }
    const saved = getWizardStep();
    if (saved !== null) {
      show({ mode: 'setup', start: resumeStep({ saved, hasWorkspace }) });
      return;
    }
    if (!hasWorkspace) {
      show({ mode: 'full', start: null });
    }
  }, [hydrated, hasWorkspace, isMainWindow, show]);

  return {
    isOpen: opening !== null,
    mode: opening?.mode ?? 'full',
    start: opening?.start ?? null,
    providersConnected,
    hasWorkspace,
    workspace,
    workspaceId,
    projectCount: projects.length,
    projects,
    close,
  };
};
