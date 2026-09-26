import {
  EmptyState,
  STRIPED_MIN_ROWS,
  STRIPED_ROW,
  STRIPED_TABLE,
  cn,
  formatTokens,
  formatUsd,
  formatUsdPrecise,
} from '@goodboy/ui';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { CoverageChip } from './CoverageChip';
import type { ModelBreakdownEntry } from './lib';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly entries: ReadonlyArray<ModelBreakdownEntry>;
  readonly formatSpent?: (value: number) => string;
  readonly borderedEmptyState?: boolean;
};

export const ModelTable = ({
  entries,
  formatSpent = formatUsd,
  borderedEmptyState = true,
}: Props) => {
  if (entries.length === 0) {
    return (
      <EmptyState
        bordered={borderedEmptyState}
        icon={CONCEPT_ICONS.budget}
        tone={CONCEPT_TONE.budget}
        title="No model usage recorded yet"
        size="inline"
        className="justify-center bg-subtle px-3 py-4"
      />
    );
  }

  const isStriped = entries.length >= STRIPED_MIN_ROWS;

  return (
    <table className={cn('w-full text-left text-label', STRIPED_TABLE)}>
      <thead className="text-eyebrow text-faint-foreground">
        <tr>
          <th className="px-3 py-2">model</th>
          <th className="px-3 py-2 text-right">in</th>
          <th className="px-3 py-2 text-right">out</th>
          <th className="px-3 py-2 text-right">cost</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={`${entry.provider}//${entry.model}`}
            className={cn('hover:[&>*]:bg-hover', isStriped && STRIPED_ROW)}
          >
            <td className="px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <RoutingLabel provider={entry.provider} model={entry.model} />
                <CoverageChip coverage={entry.coverage} />
              </span>
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(entry.tokensIn)}
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(entry.tokensOut)}
            </td>
            <td
              title={formatUsdPrecise(entry.spentUsd)}
              className="px-3 py-2 text-right font-mono tabular-nums font-medium text-foreground"
            >
              {formatSpent(entry.spentUsd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
