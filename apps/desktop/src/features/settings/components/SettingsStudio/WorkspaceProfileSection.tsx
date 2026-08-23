import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { SectionHeader, cn, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProfileSection = ({ workspaceId }: Props) => {
  const profile = useAppStore(
    (s) => s.workspaces?.find((candidate) => candidate.id === workspaceId)?.profile,
  );
  const updateWorkspaceProfile = useAppStore((s) => s.updateWorkspaceProfile);
  const { showToast } = useToast();
  const [bioDraft, setBioDraft] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBioDraft(profile?.bio ?? '');
  }, [workspaceId, profile?.bio]);

  const commitBio = async () => {
    const trimmed = bioDraft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next === (profile?.bio ?? null)) {
      return;
    }
    setBusy(true);
    try {
      await updateWorkspaceProfile({ workspaceId, profile: { bio: next } });
      showToast('success', 'profile saved');
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="profile" className="flex flex-col gap-4">
      <SectionHeader label="Profile" hint="Agents read this before they talk to you." />
      <textarea
        value={bioDraft}
        aria-label="Tell agents who you are and what you do here"
        placeholder="Tell agents who you are and what you do here"
        disabled={busy}
        rows={4}
        onChange={(event) => setBioDraft(event.target.value)}
        onBlur={() => void commitBio()}
        className={cn(
          'w-full max-w-md rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground motion-safe:transition-colors',
          'placeholder:text-muted-foreground/40',
          'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
        )}
      />
    </section>
  );
};
