import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceId, WorkspaceProfile } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ProfileForm } from '../../../../shared/components/ProfileForm';
import { normalizeWorkspaceProfile } from '../../../../shared/utils/normalizeWorkspaceProfile';
import { WorkspaceEyebrow } from './WorkspaceEyebrow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProfileSection = ({ workspaceId }: Props) => {
  const profile = useAppStore(
    (s) => s.workspaces?.find((candidate) => candidate.id === workspaceId)?.profile,
  );
  const updateWorkspaceProfile = useAppStore((s) => s.updateWorkspaceProfile);
  const reportError = useAppStore((s) => s.reportError);
  const stored = useMemo(() => normalizeWorkspaceProfile({ profile }), [profile]);
  const storedKey = JSON.stringify(stored);
  const [draft, setDraft] = useState<WorkspaceProfile>(stored);

  useEffect(() => {
    setDraft(stored);
  }, [workspaceId, storedKey]);

  const commit = async (next: WorkspaceProfile) => {
    const normalized = normalizeWorkspaceProfile({ profile: next });
    if (JSON.stringify(normalized) === storedKey) {
      return;
    }
    try {
      await updateWorkspaceProfile({ workspaceId, profile: normalized });
    } catch (error) {
      void reportError({ title: "Couldn't save what agents know about you", error, workspaceId });
    }
  };

  return (
    <section aria-labelledby="workspace-about-you" className="flex flex-col gap-3">
      <WorkspaceEyebrow id="workspace-about-you" label="About you" />
      <ProfileForm value={draft} onChange={setDraft} onCommit={(next) => void commit(next)} />
    </section>
  );
};
