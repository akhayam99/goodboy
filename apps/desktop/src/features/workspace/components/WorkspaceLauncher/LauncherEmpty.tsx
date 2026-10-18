import { Button, EmptyState, StatusDot } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import type { SetupResume } from '../../../onboarding/useSetupResume';

type Props = {
  readonly setup: SetupResume | null;
  readonly onNew: () => void;
};

export const LauncherEmpty = ({ setup, onNew }: Props) => (
  <section
    aria-label="No workspace"
    className="rounded-lg bg-subtle p-5 ring-1 ring-inset ring-border-soft"
  >
    <EmptyState
      size="page"
      illustration={null}
      title="No workspace yet"
      description="Pick a repository, or a folder that holds several."
      className="items-stretch py-0"
      action={
        <div className="flex min-w-0 items-center gap-2">
          {setup === null ? null : (
            <span className="flex min-w-0 flex-1 items-center gap-2 text-meta text-muted-foreground">
              <StatusDot tone="warning" size="sm" />
              <span className="truncate">{setup.label}</span>
            </span>
          )}
          <Button size="sm" variant={setup === null ? 'primary' : 'quiet'} onClick={onNew}>
            {NAMES.newWorkspace}
          </Button>
          {setup === null ? null : (
            <Button size="sm" onClick={setup.resume}>
              {NAMES.resumeSetup}
            </Button>
          )}
        </div>
      }
    />
  </section>
);
