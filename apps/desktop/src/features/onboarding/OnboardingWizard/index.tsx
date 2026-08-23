import { useEffect, useRef, useState } from 'react';
import { Button, ScrollFade, cn, formatError, type ButtonVariant } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { initRepo, validateGitRepo } from '../../../shared/lib/repo';
import { finishWizard } from '../onboarding-store';
import { useOnboardingWizard } from './useOnboardingWizard';
import { Stepper } from './Stepper';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { ShapeStep, type WorkspaceShape } from './steps/ShapeStep';
import { ProjectsStep } from './steps/ProjectsStep';
import { ProfileStep } from './steps/ProfileStep';
import { ReadyStep } from './steps/ReadyStep';

const STEP_COUNT = 6;
const SETUP_START_STEP = 4;
const EXIT_MS = 200;
const ALL_STEPS = Array.from({ length: STEP_COUNT }, (_, index) => index);

type Cta = {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: ButtonVariant;
  readonly disabled?: boolean;
};

export const OnboardingWizard = () => {
  const { open, mode, providersConnected, hasWorkspace, workspace, projectCount } =
    useOnboardingWizard();
  const createWorkspace = useAppStore((s) => s.createWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const updateWorkspaceProfile = useAppStore((s) => s.updateWorkspaceProfile);
  const addProject = useAppStore((s) => s.addProject);
  const adoptWorkspaceSessionsRoot = useAppStore((s) => s.adoptWorkspaceSessionsRoot);
  const [step, setStep] = useState(0);
  const [shape, setShape] = useState<WorkspaceShape | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const steps = (
    mode === 'setup' ? ALL_STEPS.filter((candidate) => candidate >= SETUP_START_STEP) : ALL_STEPS
  ).filter((candidate) => candidate !== 3 || shape !== 'single');
  const minStep = steps[0] ?? 0;
  const last = STEP_COUNT - 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(minStep);
    setShape(null);
    setClosing(false);
    setStepError(null);
    setBusy(false);
    containerRef.current?.focus();
  }, [open, minStep]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setShape((current) => current ?? (workspace === null ? null : 'workspace'));
    setWorkspaceName(workspace?.name ?? '');
    setBioDraft(workspace?.profile?.bio ?? '');
  }, [open, workspace?.id]);

  if (!open) {
    return null;
  }

  const goNext = () =>
    setStep((current) => {
      const index = steps.indexOf(current);
      return steps[index + 1] ?? last;
    });
  const goBack = () =>
    setStep((current) => {
      const index = steps.indexOf(current);
      return steps[index - 1] ?? minStep;
    });
  const canSkipSetup = hasWorkspace;
  const canDismiss = step < last && canSkipSetup;
  const dismiss = () => {
    setClosing(true);
    window.setTimeout(finishWizard, EXIT_MS);
  };

  const runStepAction = (action: () => Promise<void>) => {
    setBusy(true);
    setStepError(null);
    void action()
      .then(() => {
        goNext();
      })
      .catch((error: unknown) => {
        setStepError(formatError(error));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const commitWorkspaceName = () =>
    runStepAction(async () => {
      const name = workspaceName.trim();
      if (workspace === null) {
        const created = await createWorkspace({ name });
        await setCurrentWorkspace(created.id);
        return;
      }
      if (name !== workspace.name) {
        await renameWorkspace({ workspaceId: workspace.id, name });
      }
    });

  const commitSingleProject = ({
    path,
    initialize,
  }: {
    readonly path: string;
    readonly initialize: boolean;
  }) =>
    runStepAction(async () => {
      let rootPath = path;
      if (initialize) {
        rootPath = (await initRepo({ path })).rootPath;
      } else {
        const check = await validateGitRepo(path);
        if (!check.isRepo || check.rootPath == null || check.rootPath === '') {
          throw new Error(
            `no git repository at ${path}. pick a folder with a .git directory, or use New project to initialize one`,
          );
        }
        rootPath = check.rootPath;
      }
      const folderName =
        rootPath
          .split('/')
          .filter((part) => part.length > 0)
          .at(-1) ?? 'project';
      const created = await createWorkspace({ name: folderName });
      await setCurrentWorkspace(created.id);
      const project = await addProject({
        workspaceId: created.id,
        rootPath,
        requireRepo: true,
      });
      await adoptWorkspaceSessionsRoot({ workspaceId: created.id, rootPath: project.rootPath });
    });

  const commitProfile = () =>
    runStepAction(async () => {
      if (workspace === null) {
        return;
      }
      const bio = bioDraft.trim();
      if (bio === (workspace.profile?.bio ?? '')) {
        return;
      }
      await updateWorkspaceProfile({
        workspaceId: workspace.id,
        profile: { bio: bio === '' ? null : bio },
      });
    });

  let body = <WelcomeStep />;
  let cta: Cta = { label: 'Get started', onClick: goNext, variant: 'primary' };

  if (step === 1) {
    body = <ProvidersStep />;
    cta = {
      label: 'Continue',
      onClick: goNext,
      variant: 'primary',
      disabled: providersConnected === 0,
    };
  } else if (step === 2) {
    body = (
      <ShapeStep
        workspace={workspace}
        shape={shape}
        onShapeChange={setShape}
        name={workspaceName}
        onNameChange={setWorkspaceName}
        busy={busy}
        onSingleProject={commitSingleProject}
      />
    );
    cta =
      shape === 'single' && workspace === null
        ? {
            label: 'Continue',
            onClick: goNext,
            variant: 'primary',
            disabled: true,
          }
        : {
            label: workspace === null ? 'Create workspace' : 'Continue',
            onClick: commitWorkspaceName,
            variant: 'primary',
            disabled: busy || shape === null || workspaceName.trim().length === 0,
          };
  } else if (step === 3) {
    body = workspace === null ? <WelcomeStep /> : <ProjectsStep workspace={workspace} />;
    cta = {
      label: 'Continue',
      onClick: goNext,
      variant: 'primary',
      disabled: projectCount === 0,
    };
  } else if (step === 4) {
    body = <ProfileStep bio={bioDraft} onBioChange={setBioDraft} />;
    cta = {
      label: 'Continue',
      onClick: commitProfile,
      variant: 'primary',
      disabled: busy,
    };
  } else if (step === 5) {
    body = <ReadyStep />;
    cta = { label: 'Start building', onClick: dismiss, variant: 'primary' };
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goodboy setup"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }
        if (!canDismiss) {
          return;
        }
        event.preventDefault();
        dismiss();
      }}
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-hidden bg-background outline-none',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 45%, var(--color-background) 100%)',
        }}
        aria-hidden
      />

      <header className="relative grid min-h-[3.25rem] shrink-0 grid-cols-3 items-center px-6 pt-5">
        <span aria-hidden />
        <div className="flex justify-center">
          {step > minStep && <Stepper current={step} steps={steps} />}
        </div>
        <div className="flex justify-end">
          {canDismiss && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Skip setup
            </button>
          )}
        </div>
      </header>

      <ScrollFade className="min-h-0 flex-1">
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-xl flex-col gap-8">
            <div key={step} className="motion-safe:animate-fade-in">
              {body}
            </div>
            {stepError !== null ? (
              <p role="alert" className="text-center text-xs text-danger">
                {stepError}
              </p>
            ) : null}
            <div
              className={cn(
                'flex items-center pt-2',
                step > minStep ? 'justify-between' : 'justify-center',
              )}
            >
              {step > minStep && (
                <Button variant="ghost" size="sm" onClick={goBack} disabled={busy}>
                  Back
                </Button>
              )}
              <Button variant={cta.variant} onClick={cta.onClick} disabled={cta.disabled}>
                {cta.label}
              </Button>
            </div>
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
