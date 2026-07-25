import { FolderGit2 } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SentryIcon } from '../../../../shared/components/brand-icons';
import { SentryFormBody } from '../../../integrations/sentry/SentryFormBody';

type Props = {
  readonly workspaceId: WorkspaceId | null;
};

export const SentryStep = ({ workspaceId }: Props) => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40"
        style={{ color: 'var(--color-provider-sentry)' }}
      >
        <SentryIcon size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Triage errors with Sentry
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Link Sentry so agents can pull stack traces and triage production errors for this
          workspace. Optional, and you can connect it later.
        </p>
      </div>

      {workspaceId === null ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border-soft/40 bg-subtle/20 px-4 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-muted-foreground">
            <FolderGit2 size={18} aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add a workspace first to connect Sentry.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
          >
            <FolderGit2 size={14} aria-hidden /> Add workspace
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 text-left">
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            <SentryFormBody workspaceId={workspaceId} />
          </div>
        </div>
      )}
    </div>
  );
};
