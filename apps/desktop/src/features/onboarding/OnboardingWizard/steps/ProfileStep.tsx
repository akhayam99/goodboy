import { UserRound } from 'lucide-react';
import type { WorkspaceProfile } from '@goodboy/types';
import { ProfileForm } from '../../../../shared/components/ProfileForm';

type Props = {
  readonly profile: WorkspaceProfile;
  readonly onProfileChange: (profile: WorkspaceProfile) => void;
};

export const ProfileStep = ({ profile, onProfileChange }: Props) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft bg-subtle text-primary">
      <UserRound size={26} aria-hidden />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">About you</h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        Each agent reads the parts that help its job. It is optional, and you can edit it in
        Settings.
      </p>
    </div>

    <div className="w-full text-left">
      <ProfileForm value={profile} onChange={onProfileChange} onCommit={() => undefined} />
    </div>
  </div>
);
