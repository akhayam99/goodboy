import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { SectionHeader, Textarea } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProfileSection = ({ workspaceId }: Props) => {
  const profile = useAppStore(
    (s) => s.workspaces?.find((candidate) => candidate.id === workspaceId)?.profile,
  );
  const updateWorkspaceProfile = useAppStore((s) => s.updateWorkspaceProfile);
  const reportError = useAppStore((s) => s.reportError);
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
    } catch (error) {
      void reportError({ title: "Couldn't save the workspace profile", error, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="profile" className="flex flex-col gap-4">
      <SectionHeader label="Profile" hint="Agents read this before they talk to you." />
      <Textarea
        value={bioDraft}
        aria-label="What agents should know about this workspace and you"
        placeholder="What agents should know about this workspace and you"
        disabled={busy}
        rows={4}
        onChange={(event) => setBioDraft(event.target.value)}
        onBlur={() => void commitBio()}
        className="w-full"
      />
    </section>
  );
};
