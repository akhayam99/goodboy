import type {
  PrChecksSlotParams,
  RenderPrChecks,
} from '../../features/branch/components/DeskPr/types';
import { PrChecks } from '../../features/integrations/github/components/PullRequest/PrChecks';
import { openLink } from '../../features/open/openLink';

export const renderPrChecks: RenderPrChecks = ({
  sessionId,
  checks,
  fallbackUrl,
  host,
  isLoading,
}: PrChecksSlotParams) => (
  <PrChecks
    checks={checks}
    fallbackUrl={fallbackUrl}
    host={host}
    isLoading={isLoading}
    onOpenUrl={(url) => openLink({ url, sessionId })}
  />
);
