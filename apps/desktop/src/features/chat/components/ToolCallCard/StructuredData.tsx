import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@goodboy/ui'

type Props = {
  readonly data: unknown
  readonly depth?: number
  readonly label?: string
}

const MAX_DEPTH = 4
const LONG_STRING_THRESHOLD = 400

export const StructuredData = ({ data, depth = 0, label }: Props) => {
  if (data === null || data === undefined) {
    return <span className="italic text-muted-foreground/60">null</span>
  }

  if (typeof data === 'boolean' || typeof data === 'number') {
    return <span className="text-info">{String(data)}</span>
  }

  if (typeof data === 'string') {
    if (data.length > LONG_STRING_THRESHOLD) {
      return <CollapsibleString value={data} label={label} />
    }
    return <span className="whitespace-pre-wrap break-words text-foreground/80">{data}</span>
  }

  if (depth >= MAX_DEPTH) {
    return <RawJson data={data} />
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground/60">[]</span>
    }
    const allPrimitive = data.every(
      (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    )
    if (allPrimitive && data.length <= 8) {
      return (
        <span className="flex flex-wrap gap-1">
          {data.map((v, i) => (
            <span
              key={i}
              className="inline-block rounded bg-muted/50 px-1.5 py-0.5 text-foreground/80"
            >
              {String(v)}
            </span>
          ))}
        </span>
      )
    }
    return (
      <div className="flex flex-col gap-0.5">
        {data.map((v, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="shrink-0 text-muted-foreground/50">{i}:</span>
            <StructuredData data={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-muted-foreground/60">{'{}'}</span>
    }
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {entries.map(([key, val]) => (
          <div key={key} className="contents">
            <span className="shrink-0 text-muted-foreground">{key}</span>
            <StructuredData data={val} depth={depth + 1} label={key} />
          </div>
        ))}
      </div>
    )
  }

  return <RawJson data={data} />
}

function CollapsibleString({ value, label }: { value: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const preview = value.slice(0, 120) + '...'
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-left text-muted-foreground/70 hover:text-foreground/80"
      >
        <ChevronRight
          size={10}
          aria-hidden
          className={cn('shrink-0 motion-safe:transition-transform', open && 'rotate-90')}
        />
        <span className="text-2xs">
          {label ?? 'string'} ({value.length} chars)
        </span>
      </button>
      {open ? (
        <pre className="mt-0.5 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-1.5 text-foreground/80">
          {value}
        </pre>
      ) : (
        <span className="text-foreground/60">{preview}</span>
      )}
    </div>
  )
}

function RawJson({ data }: { data: unknown }) {
  return (
    <pre className="whitespace-pre-wrap break-words text-muted-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
