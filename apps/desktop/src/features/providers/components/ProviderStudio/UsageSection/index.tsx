import { PROVIDERS_REPORTING_LIMITS } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { Notice, STRIPED_LIST, STRIPED_MIN_ROWS, SectionHeader, cn } from '@goodboy/ui';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { useAutoDetour } from '../../../hooks/useAutoDetour';
import { useProviderLimitsChip } from '../../../hooks/useProviderLimitsChip';
import { sortLimitWindows } from '../../../limits/limitWindowLabel';
import { usageNotice } from '../../../limits/usageNotice';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { SpendInGoodboy } from './SpendInGoodboy';
import { USAGE_SECTION_ID } from './usageSectionId';
import { UsageWindowRow } from './UsageWindowRow';

type Props = {
  readonly providerId: ProviderId;
  readonly billing: 'plan' | 'token';
};

const SOURCE_LINE: Partial<Record<ProviderId, string>> = {
  anthropic:
    'Claude shares these numbers during each turn. Goodboy never reads your Claude sign-in.',
  codex: 'Codex writes these numbers to its session files after each turn.',
};

export const UsageSection = ({ providerId, billing }: Props) => {
  const { chip, nowMs } = useProviderLimitsChip({ providerId });
  const label = PROVIDER_LABEL[providerId];
  const windows = sortLimitWindows({ windows: chip.windows });
  const detour = useAutoDetour({ providerId });
  const notice = usageNotice({ chip, nowMs, detour });
  const reports = PROVIDERS_REPORTING_LIMITS.includes(providerId);
  const reportedBy =
    chip.observedAt === null
      ? null
      : `Reported by ${label} · Updated ${formatRelativeAge({ fromIso: chip.observedAt, nowMs })}`;

  return (
    <div id={USAGE_SECTION_ID} className="flex scroll-mt-4 flex-col gap-6">
      <section aria-label="Usage limits" className="flex flex-col gap-2">
        <SectionHeader
          label="Usage limits"
          action={
            reportedBy === null ? undefined : (
              <span className="text-secondary text-faint-foreground">{reportedBy}</span>
            )
          }
        />
        {billing === 'token' ? (
          <p className="text-label text-muted-foreground">Billed per token. No usage windows.</p>
        ) : (
          <>
            {windows.length > 0 ? (
              <ul
                aria-label={`${label} usage windows`}
                className={cn('flex flex-col', windows.length >= STRIPED_MIN_ROWS && STRIPED_LIST)}
              >
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
            {notice === null ? null : (
              <Notice
                tone={notice.tone}
                placement="inline"
                title={notice.title}
                {...(notice.body !== null && { body: notice.body })}
              />
            )}
            {reports ? (
              <p className="text-secondary text-faint-foreground">
                {providerId === 'anthropic' && windows.length === 1
                  ? `${SOURCE_LINE[providerId] ?? ''} Claude reports only the window that limits you right now.`
                  : SOURCE_LINE[providerId]}
              </p>
            ) : null}
          </>
        )}
      </section>
      <SpendInGoodboy providerId={providerId} hasPlan={billing === 'plan' && reports} />
    </div>
  );
};
