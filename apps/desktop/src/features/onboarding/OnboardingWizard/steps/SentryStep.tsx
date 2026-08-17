import { FolderGit2 } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SentryIcon } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
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
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.workspace}
          tone={CONCEPT_TONE.workspace}
          title="Add a workspace first to connect Sentry."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
            >
              <FolderGit2 size={14} aria-hidden /> Add workspace
            </Button>
          }
        />
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
