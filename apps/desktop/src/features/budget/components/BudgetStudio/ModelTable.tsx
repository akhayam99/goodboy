import { formatUsdPrecise } from '@goodboy/ui'
import { ProviderIcon } from './ProviderIcon'
import { formatModel, formatTokens, type ModelBreakdownEntry } from './lib'

type Props = {
  readonly entries: ReadonlyArray<ModelBreakdownEntry>
  readonly showProvider: boolean
}

export const ModelTable = ({ entries, showProvider }: Props) => {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
        no model usage recorded yet.
      </p>
    )
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
              <span className="flex items-center gap-2">
                {showProvider ? <ProviderIcon provider={entry.provider} size={14} /> : null}
                <span className="font-mono text-foreground">{formatModel(entry.model)}</span>
              </span>
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
  )
}
