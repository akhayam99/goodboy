import type { ReactNode } from 'react';
import { AgentAvatar, type AgentKind } from '../components/AgentAvatar';

export const KIND = {
  scout: { bg: 'bg-sky-400', label: 'scout', kind: 'scout' as AgentKind },
  plan: { bg: 'bg-violet-400', label: 'plan', kind: 'planner' as AgentKind },
  imple: { bg: 'bg-emerald-400', label: 'imple', kind: 'implementer' as AgentKind },
  review: { bg: 'bg-cyan-400', label: 'review', kind: 'reviewer' as AgentKind },
  debug: { bg: 'bg-amber-400', label: 'debug', kind: 'debugger' as AgentKind },
  test: { bg: 'bg-teal-400', label: 'test', kind: 'tester' as AgentKind },
  docs: { bg: 'bg-orange-400', label: 'docs', kind: 'docs' as AgentKind },
  generic: { bg: 'bg-rose-400', label: 'agent', kind: 'generic' as AgentKind },
} as const;

export type KindKey = keyof typeof KIND;

export function KindBadge({ kind, muted }: { kind: KindKey; muted?: boolean }) {
  const k = KIND[kind];
  return (
    <span
      className={[
        'inline-flex w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded py-0.5 pl-1 pr-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
        muted ? 'bg-muted-foreground/20 text-muted-foreground/60' : `${k.bg} text-zinc-950`,
      ].join(' ')}
    >
      <AgentAvatar
        kind={k.kind}
        size={10}
        tint={muted ? 'bg-muted-foreground/60' : 'bg-zinc-950/80'}
      />
      <span>{k.label}</span>
    </span>
  );
}

export function SnapshotFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'relative mx-auto w-full overflow-hidden rounded-xl border border-border-soft bg-[oklch(0.25_0.006_255)] shadow-md',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

export function FrameHeader({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-2 edge-b bg-[oklch(0.27_0.008_255)] px-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
        {label}
      </span>
      {right}
    </div>
  );
}
