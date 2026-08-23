import { DogMascot } from '../../../../shared/components/DogMascot';

export const WelcomeStep = () => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 shadow-lg backdrop-blur-sm">
          <DogMascot size={56} className="text-foreground" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to Goodboy
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Connect a provider, point it at your work, and start your first session.
        </p>
      </div>
    </div>
  );
};
