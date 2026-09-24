import { UserRound } from 'lucide-react';
import { Textarea } from '@goodboy/ui';

type Props = {
  readonly bio: string;
  readonly onBioChange: (bio: string) => void;
};

export const ProfileStep = ({ bio, onBioChange }: Props) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft bg-subtle text-primary">
      <UserRound size={26} aria-hidden />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        What agents should know about this workspace and you
      </h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        Agents read this before they talk to you. It is optional, and you can edit it in Settings.
      </p>
    </div>

    <Textarea
      value={bio}
      aria-label="What agents should know about this workspace and you"
      placeholder="I lead design for the checkout team. I do not write code, so walk me through changes as outcomes…"
      rows={5}
      onChange={(event) => onBioChange(event.target.value)}
      className="w-full text-left"
    />
  </div>
);
