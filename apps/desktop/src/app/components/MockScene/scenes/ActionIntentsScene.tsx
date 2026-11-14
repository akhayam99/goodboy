import { Button, Eyebrow } from '@goodboy/ui';
import type { ButtonIntent, ButtonVariant } from '@goodboy/ui';

type Look = {
  readonly name: string;
  readonly variant: ButtonVariant;
};

const LOOKS = [
  { name: 'filled', variant: 'primary' },
  { name: 'outline', variant: 'secondary' },
  { name: 'quiet', variant: 'quiet' },
] as const satisfies ReadonlyArray<Look>;

const INTENTS = [
  { intent: 'primary', label: 'Push' },
  { intent: 'neutral', label: 'Open' },
  { intent: 'caution', label: 'Rebase' },
  { intent: 'destructive', label: 'Remove worktree' },
] as const satisfies ReadonlyArray<{ readonly intent: ButtonIntent; readonly label: string }>;

export const ActionIntentsScene = () => (
  <main className="flex h-screen w-full flex-col gap-6 overflow-hidden bg-background p-6 text-foreground">
    {INTENTS.map(({ intent, label }) => (
      <section key={intent} aria-label={intent} className="flex flex-col gap-2">
        <Eyebrow label={intent} />
        <div className="flex items-center gap-4">
          {LOOKS.map((look) => (
            <Button key={look.name} variant={look.variant} intent={intent}>
              {label}
            </Button>
          ))}
          <Button variant="secondary" intent={intent} disabled>
            {label}
          </Button>
        </div>
      </section>
    ))}
  </main>
);
