import type { ProviderLifecycleAction } from '@goodboy/types';

type Props = {
  readonly action: ProviderLifecycleAction;
};

export const Stepper = ({ action }: Props) => {
  if (action === 'logout') {
    return null;
  }
  const current = action === 'install' ? 1 : 2;
  return (
    <div
      className="flex items-center gap-1.5 text-3xs uppercase tracking-wide text-muted-foreground"
      aria-label={`Step ${current} of 2`}
    >
      <span>Step {current} of 2</span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <span className="text-foreground">
        {action === 'install' ? 'Installing CLI' : 'Signing in'}
      </span>
    </div>
  );
};
