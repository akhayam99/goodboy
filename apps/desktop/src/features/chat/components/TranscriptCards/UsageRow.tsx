import { formatTokens, formatUsd, MetaRow } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptShell } from '../TranscriptShell';

type UsageStatProps = {
  value: string;
  label: string;
};

const UsageStat = ({ value, label }: UsageStatProps) => {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="tabular-nums text-foreground/70">{value}</span>
      <span className="uppercase tracking-wide text-muted-foreground/50">{label}</span>
    </span>
  );
};

type Props = {
  usage: Extract<TranscriptItem, { kind: 'usage' }>['usage'];
};

export const UsageRow = ({ usage }: Props) => {
  return (
    <TranscriptShell tone="neutral" variant="boxed" className="flex w-fit">
      <MetaRow
        items={[
          <UsageStat key="in" value={formatTokens(usage.inputTokens)} label="in" />,
          <UsageStat key="out" value={formatTokens(usage.outputTokens)} label="out" />,
          usage.cachedInputTokens > 0 ? (
            <UsageStat key="cached" value={formatTokens(usage.cachedInputTokens)} label="cached" />
          ) : null,
          usage.estimatedCostUsd > 0 ? (
            <span key="cost" className="tabular-nums text-foreground/70">
              ~{formatUsd(usage.estimatedCostUsd)}
            </span>
          ) : null,
        ]}
      />
    </TranscriptShell>
  );
};
