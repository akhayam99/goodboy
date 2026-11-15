import { Button, Eyebrow } from '@goodboy/ui';
import type { ButtonIntent, ButtonVariant } from '@goodboy/ui';

type LookName = 'filled' | 'outline' | 'quiet';

type Look = {
  readonly name: LookName;
  readonly variant: ButtonVariant;
};

const LOOKS = [
  { name: 'filled', variant: 'primary' },
  { name: 'outline', variant: 'secondary' },
  { name: 'quiet', variant: 'quiet' },
] as const satisfies ReadonlyArray<Look>;

type IntentRow = {
  readonly intent: ButtonIntent;
  readonly label: string;
  readonly looks: ReadonlyArray<LookName>;
};

const INTENTS: ReadonlyArray<IntentRow> = [
  { intent: 'primary', label: 'Push', looks: ['filled'] },
  { intent: 'neutral', label: 'Open', looks: ['outline', 'quiet'] },
  { intent: 'caution', label: 'Rebase', looks: ['filled', 'outline', 'quiet'] },
  { intent: 'destructive', label: 'Remove worktree', looks: ['filled', 'outline', 'quiet'] },
];

export const ActionIntentsScene = () => (
  <main className="flex h-screen w-full flex-col gap-6 overflow-hidden bg-background p-6 text-foreground">
    {INTENTS.map(({ intent, label, looks }) => (
      <section key={intent} aria-label={intent} className="flex flex-col gap-2">
        <Eyebrow label={intent} />
        <div className="grid grid-cols-[repeat(4,10rem)] items-center gap-4">
          {LOOKS.map((look) =>
            looks.includes(look.name) ? (
              <span key={look.name} className="flex">
                <Button variant={look.variant} intent={intent}>
                  {label}
                </Button>
              </span>
            ) : (
              <span key={look.name} className="text-meta text-faint-foreground">
                {`No ${look.name} look`}
              </span>
            ),
          )}
          <span className="flex">
            <Button variant="secondary" intent={intent} disabled>
              {label}
            </Button>
          </span>
        </div>
      </section>
    ))}
  </main>
);
