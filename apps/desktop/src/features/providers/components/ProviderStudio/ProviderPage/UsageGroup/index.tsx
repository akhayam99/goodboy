import { PROVIDERS_REPORTING_LIMITS, sortLimitWindows } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Band, Button, Notice, RefreshIconButton, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { formatRelativeAge } from '../../../../../../shared/utils/relativeDate';
import { useAutoDetour } from '../../../../hooks/useAutoDetour';
import { useProviderLimitsChip } from '../../../../hooks/useProviderLimitsChip';
import { usageNotice } from '../../../../limits/usageNotice';
import { PROVIDER_LABEL } from '../../../../providerLabel';
import { ClaudeResetLink } from './ClaudeResetLink';
import { ResetCreditRow } from './ResetCreditRow';
import { SpendInGoodboy } from './SpendInGoodboy';
import { USAGE_SECTION_ID } from './usageSectionId';
import { UsageWindowRow } from './UsageWindowRow';

type Props = {
  readonly providerId: ProviderId;
  readonly billing: 'plan' | 'token';
  readonly planLabel: string | null;
};

const PROBE_FAILURE_LIMIT = 3;

const useRefreshUsage = ({ providerId }: { readonly providerId: ProviderId }) => {
  const refreshClaudeUsage = useAppStore((state) => state.refreshClaudeUsage);
  const refreshCodexLimits = useAppStore((state) => state.refreshCodexLimits);
  if (providerId === 'anthropic') {
    return () => void refreshClaudeUsage();
  }
  if (providerId === 'codex') {
    return () => void refreshCodexLimits({ withResetDetails: true });
  }
  return null;
};

export const UsageGroup = ({ providerId, billing, planLabel }: Props) => {
  const { chip, nowMs } = useProviderLimitsChip({ providerId });
  const probe = useAppStore((state) => state.providerLimitsProbe[providerId] ?? null);
  const refresh = useRefreshUsage({ providerId });
  const label = PROVIDER_LABEL[providerId];
  const windows = sortLimitWindows({ windows: chip.windows });
  const detour = useAutoDetour({ providerId });
  const notice = billing === 'token' ? null : usageNotice({ chip, nowMs, detour });
  const reports = PROVIDERS_REPORTING_LIMITS.includes(providerId);
  const isChecking = probe?.isChecking === true;
  const hasFailed = (probe?.failures ?? 0) >= PROBE_FAILURE_LIMIT;
  const lastAge =
    chip.observedAt === null ? null : formatRelativeAge({ fromIso: chip.observedAt, nowMs });
  const isClaudeOut =
    providerId === 'anthropic' &&
    windows.some((window) => window.status === 'reached' || (window.usedFraction ?? 0) >= 1);
  const status = isChecking ? 'Checking…' : lastAge === null ? null : `Updated ${lastAge}`;

  return (
    <div id={USAGE_SECTION_ID} className="flex scroll-mt-4 flex-col gap-2">
      <Band
        label="Usage"
        ariaLabel="Usage"
        action={
          billing === 'token' || !reports ? undefined : (
            <div className="flex items-center gap-1">
              {status === null ? null : (
                <span className="text-secondary text-faint-foreground">{status}</span>
              )}
              {refresh === null ? null : (
                <RefreshIconButton
                  label={`Check ${label} usage now`}
                  onClick={refresh}
                  isLoading={isChecking}
                />
              )}
            </div>
          )
        }
      >
        {billing === 'token' ? (
          <p className={cn(BAND_ROW_CLASS, 'text-label text-muted-foreground')}>
            Billed per token by your key. No usage windows.
          </p>
        ) : null}
        {billing === 'plan' && windows.length > 0 ? (
          <ul aria-label={`${label} usage windows`} className="flex flex-col">
            {windows.map((window) => (
              <UsageWindowRow
                key={`${window.kind}:${window.model ?? ''}`}
                window={window}
                siblings={windows}
                nowMs={nowMs}
              />
            ))}
          </ul>
        ) : null}
        {billing === 'plan' && providerId === 'codex' ? <ResetCreditRow nowMs={nowMs} /> : null}
        {isClaudeOut ? <ClaudeResetLink /> : null}
        {hasFailed && !isChecking ? (
          <Notice
            tone="warning"
            placement="inline"
            title={`Couldn't check ${label} usage.`}
            {...(lastAge !== null && { body: `Last checked ${lastAge}.` })}
            {...(refresh !== null && {
              actions: (
                <Button size="sm" variant="secondary" onClick={refresh}>
                  Try again
                </Button>
              ),
            })}
          />
        ) : notice === null ? null : (
          <Notice
            tone={notice.tone}
            placement="inline"
            title={notice.title}
            {...(notice.body !== null && { body: notice.body })}
          />
        )}
        <SpendInGoodboy providerId={providerId} />
      </Band>
      {billing === 'plan' && reports ? (
        <p className="px-2 text-secondary text-faint-foreground">
          {`Your ${planLabel ?? label} plan covers this. The figure is what the same tokens would cost on the API. Goodboy asks the ${label} CLI for these numbers and never reads your sign-in.`}
        </p>
      ) : null}
    </div>
  );
};
