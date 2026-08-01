import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workspace, WorkspaceId, WorkspaceKind } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { ghStatus } from '../../../github/github';
import { isWizardDone, OPEN_WIZARD_EVENT, type WizardMode } from '../../onboarding-store';

export type OnboardingWizardState = {
  readonly open: boolean;
  readonly mode: WizardMode;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
  readonly workspace: Workspace | null;
  readonly workspaceId: WorkspaceId | null;
  readonly workspaceKind: WorkspaceKind | null;
  readonly githubConnected: boolean;
  readonly gitlabConnected: boolean;
  readonly hasCodeHost: boolean;
  readonly hasLinear: boolean;
  readonly hasSentry: boolean;
  readonly refreshGithubStatus: () => void;
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
  const workspaceKind = workspace?.kind ?? (workspace !== null ? 'repo' : null);
  const hasWorkspace = workspace !== null;
  const hydrated = useAppStore((s) => s.hydrated);

  const gitlabConnected = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'gitlab')
      : false,
  );
  const hasLinear = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'linear')
      : false,
  );
  const hasSentry = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'sentry')
      : false,
  );

  const [githubScoped, setGithubScoped] = useState(false);
  const refreshGithubStatus = useCallback(() => {
    if (!workspaceId || workspaceKind === 'simple') {
      setGithubScoped(false);
      return;
    }
    void ghStatus(workspaceId)
      .then((status) => setGithubScoped(status.scoped ?? false))
      .catch(() => setGithubScoped(false));
  }, [workspaceId, workspaceKind]);

  useEffect(() => {
    refreshGithubStatus();
  }, [refreshGithubStatus]);

  const hasCodeHost = githubScoped || gitlabConnected;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WizardMode>('full');
  const decided = useRef(false);
  const openRef = useRef(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const requested = (e as CustomEvent<{ mode?: WizardMode }>).detail?.mode ?? 'full';
      if (requested === 'setup' && openRef.current) {
        return;
      }
      decided.current = true;
      openRef.current = true;
      setMode(requested);
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
    providersConnected,
    hasWorkspace,
    workspace,
    workspaceId,
    workspaceKind,
    githubConnected: githubScoped,
    gitlabConnected,
    hasCodeHost,
    hasLinear,
    hasSentry,
    refreshGithubStatus,
  };
};
