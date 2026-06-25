import { useMemo, useState } from 'react'
import { cn, formatUsdPrecise } from '@goodboy/ui'
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys'
import { ProviderIcon } from './ProviderIcon'
import { Widget } from './Widget'
import { formatModel, formatTokens, sortTurns, type SortKey, type WorkspaceTurn } from './lib'

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>
  readonly showProvider: boolean
  readonly showSession: boolean
}

const SORT_KEY_STORAGE = STORAGE_KEYS.pricingSortKey
const PAGE_SIZE = 10

export const TurnsTable = ({ turns, showProvider, showSession }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_KEY_STORAGE)
    return stored === 'expensive' ? 'expensive' : 'recent'
  })
  const [visible, setVisible] = useState(PAGE_SIZE)

  const sorted = useMemo(() => sortTurns(turns, sortKey), [turns, sortKey])
  const shown = sorted.slice(0, visible)
  const remaining = sorted.length - shown.length

  const handleSortKey = (key: SortKey) => {
    setSortKey(key)
    setVisible(PAGE_SIZE)
    localStorage.setItem(SORT_KEY_STORAGE, key)
  }

  const action = (
    <div className="flex gap-1">
      <SortChip
        active={sortKey === 'recent'}
        onClick={() => handleSortKey('recent')}
        label="recent"
      />
      <SortChip
        active={sortKey === 'expensive'}
        onClick={() => handleSortKey('expensive')}
        label="expensive"
      />
    </div>
  )

  return (
    <Widget label="turns" action={action}>
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">no recorded turns yet.</p>
      ) : (
        <>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">type</th>
                {showProvider ? <th className="w-8 px-1 py-2 font-medium" /> : null}
                <th className="px-2 py-2 font-medium">model</th>
                {showSession ? <th className="px-2 py-2 font-medium">session</th> : null}
                <th className="px-2 py-2 text-right font-medium">in</th>
                <th className="px-2 py-2 text-right font-medium">out</th>
                <th className="px-2 py-2 text-right font-medium">cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {shown.map(({ record, sessionGoal }) => (
                <tr key={record.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-2xs font-medium uppercase',
                        record.kind === 'summarizer'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      {record.kind}
                    </span>
                  </td>
                  {showProvider ? (
                    <td className="px-1 py-2">
                      <ProviderIcon provider={record.provider} size={14} />
                    </td>
                  ) : null}
                  <td className="px-2 py-2 font-mono text-foreground">
                    {formatModel(record.model)}
                  </td>
                  {showSession ? (
                    <td
                      className="max-w-[12rem] truncate px-2 py-2 text-muted-foreground"
                      title={sessionGoal}
                    >
                      {sessionGoal}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {formatTokens(record.inputTokens)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {formatTokens(record.outputTokens)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums font-medium text-foreground">
                    {formatUsdPrecise(record.estimatedCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-1 self-center rounded-md border border-border-soft px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Show more ({remaining})
            </button>
          )}
        </>
      )}
    </Widget>
  )
}

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-1.5 py-0.5 text-2xs uppercase tracking-[0.08em]',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}
