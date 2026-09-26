import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SECRET_KIND_LABEL, SecurityFindingRow } from './SecurityFindingRow';

type Props = {
  readonly workspaceId: WorkspaceId | null;
};

export const SecurityFindingsSection = ({ workspaceId }: Props) => {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const loadSecurityFindings = useAppStore((state) => state.loadSecurityFindings);
  const dismissSecurityFinding = useAppStore((state) => state.dismissSecurityFinding);
  const flagSecurityFindingAgain = useAppStore((state) => state.flagSecurityFindingAgain);
  const open = useAppStore((state) =>
    workspaceId === null ? [] : (state.openSecurityFindings[workspaceId] ?? []),
  );
  const dismissed = useAppStore((state) =>
    workspaceId === null ? [] : (state.dismissedSecurityFindings[workspaceId] ?? []),
  );
  const projectScripts = useAppStore((state) =>
    workspaceId === null ? [] : (state.projectScripts[workspaceId] ?? []),
  );
  const projectNameById = useAppStore((state) =>
    Object.fromEntries(state.projects.map((project) => [project.id, project.name])),
  );
  const [isDismissedOpen, setIsDismissedOpen] = useState(false);

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    setStatus('loading');
    void loadSecurityFindings({ workspaceId }).finally(() => setStatus('ready'));
  }, [loadSecurityFindings, workspaceId]);

  if (workspaceId === null) {
    return <p className="text-sm text-muted-foreground">Add a workspace to see this.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Goodboy checks the text it keeps for you (saved scripts, workflow prompts, your profile,
        reply templates, permission rules) for anything that looks like a key or a token. This text
        never leaves your Mac.
      </p>
      {open.length > 0 && (
        <p className="text-xs text-faint-foreground">
          Keep the value in your shell or in a .env file git ignores, and use its name instead:{' '}
          <code>$DEPLOY_TOKEN</code>.
        </p>
      )}
      {status === 'loading' && <p className="text-sm text-muted-foreground">Checking…</p>}
      {status === 'ready' && open.length === 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck size={ICON_SIZE.row} aria-hidden />
          No findings.
        </p>
      )}
      {open.map((finding) => (
        <SecurityFindingRow
          key={finding.id}
          finding={finding}
          projectScripts={projectScripts}
          projectNameById={projectNameById}
          onNotASecret={({ finding: target }) =>
            dismissSecurityFinding({ workspaceId, findingId: target.id })
          }
        />
      ))}
      {dismissed.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsDismissedOpen((value) => !value)}
            className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {`Dismissed ${dismissed.length}`}
          </button>
          {isDismissedOpen &&
            dismissed.map((finding) => (
              <div
                key={finding.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border-soft bg-subtle px-3 py-2 text-xs text-muted-foreground"
              >
                <span className="font-mono">
                  {SECRET_KIND_LABEL[finding.secretKind]} ending ••••{finding.last4}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void flagSecurityFindingAgain({ workspaceId, findingId: finding.id })
                  }
                >
                  Flag again
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
