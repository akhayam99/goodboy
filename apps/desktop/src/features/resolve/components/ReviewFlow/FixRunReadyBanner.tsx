import { Notice } from '@goodboy/ui';
import type { FixRunReady } from '../../fixRunReady';
import { FIX_RUN_READY_LABEL, fixRunReadyBody, fixRunReadyTitle } from '../../fixRunReadyCopy';

type Props = {
  readonly ready: FixRunReady;
  readonly provider: string;
  readonly canResolve: boolean;
};

export const FixRunReadyBanner = ({ ready, provider, canResolve }: Props) => (
  <section aria-label={FIX_RUN_READY_LABEL.region} data-testid="fix-run-ready" className="min-w-0">
    <Notice
      tone="info"
      placement="banner"
      title={fixRunReadyTitle({ count: ready.threadIds.length })}
      body={fixRunReadyBody({ ready, provider, canResolve })}
    />
  </section>
);
