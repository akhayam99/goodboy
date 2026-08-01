import { EmptyState, formatTokens, formatUsdPrecise } from '@goodboy/ui';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import type { ModelBreakdownEntry } from './lib';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly entries: ReadonlyArray<ModelBreakdownEntry>;
};

export const ModelTable = ({ entries }: Props) => {
  if (entries.length === 0) {
    return (
      <EmptyState
        bordered
        icon={CONCEPT_ICONS.budget}
        title="No model usage recorded yet"
        size="inline"
        className="justify-center border-solid bg-muted/10 px-3 py-4"
      />
    );
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="px-3 py-2 font-medium">model</th>
          <th className="px-3 py-2 text-right font-medium">in</th>
          <th className="px-3 py-2 text-right font-medium">out</th>
          <th className="px-3 py-2 text-right font-medium">cost</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft">
        {entries.map((entry) => (
          <tr
            key={`${entry.provider}//${entry.model}`}
            className="transition-colors hover:bg-muted/30"
          >
            <td className="px-3 py-2">
              <RoutingBadge provider={entry.provider} model={entry.model} />
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(entry.tokensIn)}
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatTokens(entry.tokensOut)}
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-foreground">
              {formatUsdPrecise(entry.spentUsd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
