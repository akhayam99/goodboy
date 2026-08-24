import { UserRound } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly bio: string;
  readonly onBioChange: (bio: string) => void;
};

export const ProfileStep = ({ bio, onBioChange }: Props) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
      <UserRound size={26} aria-hidden />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        Tell agents who you are and what you do here
      </h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        Agents read this before they talk to you; it is optional and editable in settings.
      </p>
    </div>

    <textarea
      value={bio}
      aria-label="Tell agents who you are and what you do here"
      placeholder="I lead design for the checkout team. I do not write code, so walk me through changes as outcomes…"
      rows={5}
      onChange={(event) => onBioChange(event.target.value)}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground motion-safe:transition-colors',
        'placeholder:text-muted-foreground/40',
        'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
      )}
    />
  </div>
);
