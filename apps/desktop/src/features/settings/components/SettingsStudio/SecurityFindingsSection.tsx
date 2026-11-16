import { useEffect, useState } from 'react';
import { ShieldCheck } from '@goodboy/ui/icons';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Button, EmptyLine, ICON_SIZE, SectionHeader, SkeletonRow } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SECRET_KIND_LABEL, SecurityFindingRow } from './SecurityFindingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const SECRETS_LABEL = 'Secrets in saved scripts';

const SECRETS_HINT = 'Keys or tokens in your saved scripts. This text never leaves your Mac.';

export const SecurityFindingsSection = ({ workspaceId }: Props) => {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const loadSecurityFindings = useAppStore((state) => state.loadSecurityFindings);
  const dismissSecurityFinding = useAppStore((state) => state.dismissSecurityFinding);
  const flagSecurityFindingAgain = useAppStore((state) => state.flagSecurityFindingAgain);
  const open = useAppStore(useShallow((state) => state.openSecurityFindings[workspaceId] ?? []));
  const dismissed = useAppStore(
    useShallow((state) => state.dismissedSecurityFindings[workspaceId] ?? []),
  );
  const projectScripts = useAppStore(
    useShallow((state) => state.projectScripts[workspaceId] ?? []),
  );
  const projectNameById = useAppStore(
    useShallow((state) =>
      Object.fromEntries(state.projects.map((project) => [project.id, project.name])),
    ),
  );
  const [isDismissedOpen, setIsDismissedOpen] = useState(false);

  useEffect(() => {
    setStatus('loading');
    void loadSecurityFindings({ workspaceId }).finally(() => setStatus('ready'));
  }, [loadSecurityFindings, workspaceId]);

  return (
    <section aria-label={SECRETS_LABEL} className="flex flex-col gap-2">
      <SectionHeader
        label={SECRETS_LABEL}
        hint={SECRETS_HINT}
        icon={<CONCEPT_ICONS.security size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      />
      {open.length > 0 && (
        <p className="text-meta text-faint-foreground">
          Keep the value in your shell or in a .env file git ignores, and use its name instead:{' '}
          <code>$DEPLOY_TOKEN</code>.
        </p>
      )}
      {status === 'loading' && open.length === 0 && (
        <Band inset="content">
          <SkeletonRow label="Checking saved scripts" />
        </Band>
      )}
      {status === 'ready' && open.length === 0 && (
        <Band inset="content">
          <EmptyLine icon={ShieldCheck}>No findings in your saved scripts.</EmptyLine>
        </Band>
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
            className="self-start text-meta text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {`Dismissed ${dismissed.length}`}
          </button>
          {isDismissedOpen &&
            dismissed.map((finding) => (
              <div
                key={finding.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border-soft bg-subtle px-3 py-2 text-meta text-muted-foreground"
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
    </section>
  );
};
