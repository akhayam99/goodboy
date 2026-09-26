import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, Workspace, WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import {
  isWizardDone,
  OPEN_WIZARD_EVENT,
  type OpenWizardDetail,
  type WizardMode,
} from '../../onboarding-store';
import type { WizardStepId } from '../wizardSteps';

export type OnboardingWizardState = {
  readonly open: boolean;
  readonly mode: WizardMode;
  readonly start: WizardStepId | null;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
  readonly workspace: Workspace | null;
  readonly workspaceId: WorkspaceId | null;
  readonly projectCount: number;
  readonly projects: ReadonlyArray<Project>;
};

export const useOnboardingWizard = (): OnboardingWizardState => {
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

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WizardMode>('full');
  const [start, setStart] = useState<WizardStepId | null>(null);
  const decided = useRef(false);
  const openRef = useRef(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<Partial<OpenWizardDetail> | null>).detail;
      const requested = detail?.mode ?? 'full';
      if (requested !== 'full' && openRef.current) {
        return;
      }
      decided.current = true;
      openRef.current = true;
      setMode(requested);
      setStart(detail?.step ?? null);
      setOpen(true);
    };
    const onProgress = () => {
      if (isWizardDone()) {
        decided.current = true;
        openRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    window.addEventListener('goodboy:onboarding-progress', onProgress);
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);
      window.removeEventListener('goodboy:onboarding-progress', onProgress);
    };
  }, []);

  useEffect(() => {
    if (decided.current || !hydrated) {
      return;
    }
    if (!isWizardDone() && !hasWorkspace) {
      decided.current = true;
      openRef.current = true;
      setOpen(true);
    }
  }, [hydrated, hasWorkspace]);

  return {
    open,
    mode,
    start,
    providersConnected,
    hasWorkspace,
    workspace,
    workspaceId,
    projectCount: projects.length,
    projects,
  };
};
