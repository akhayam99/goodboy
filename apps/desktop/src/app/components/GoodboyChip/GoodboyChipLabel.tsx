import type { OnboardingProgress } from '../../../features/onboarding/hooks/useOnboardingProgress';
import { BrandLockup } from './BrandLockup';

export type GoodboyChipState = 'update' | 'setup' | 'rest';

type Props = {
  readonly state: GoodboyChipState;
  readonly progress: OnboardingProgress;
  readonly installedVersion: string | null;
  readonly isMarkOnly?: boolean;
};

export const GoodboyChipLabel = ({
  state,
  progress,
  installedVersion,
  isMarkOnly = false,
}: Props) => {
  if (isMarkOnly) {
    return <BrandLockup version={installedVersion} isMarkOnly />;
  }
  if (state === 'update') {
    return (
      <>
        <span data-lockup-wide="" className="contents @max-[10.5rem]:hidden">
          <BrandLockup version={installedVersion} hasMeta={false} />
        </span>
        <span data-lockup-narrow="" className="hidden @max-[10.5rem]:contents">
          <BrandLockup version={installedVersion} isMarkOnly />
        </span>
      </>
    );
  }
  if (state === 'setup') {
    return (
      <>
        <span className="font-semibold text-foreground">Setup</span>
        <span className="tabular-nums text-faint-foreground">{progress.setup.count}</span>
      </>
    );
  }
  return <BrandLockup version={installedVersion} />;
};
