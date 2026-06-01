import type { ReactNode } from 'react';
import { AgentAvatar } from '../components/AgentAvatar';
import {
  IconBranch,
  IconCheck,
  IconClipboard,
  IconHelp,
  IconList,
  IconPlus,
  IconTarget,
  IconTerminal,
} from '../components/Icons';
import { KIND, type KindKey } from '../mockups/primitives';
import {
  CHAT_TURNS,
  CLUSTERS,
  DECISIONS,
  OPEN_QUESTION,
  PLAN,
  PR,
  QUESTION_SUGGESTIONS,
  RUN_STEPS,
  SESSION_GOAL,
  type StepStatus,
  type TourView,
} from './tourScript';

type RegionRef = (node: HTMLElement | null) => void;

interface CanvasProps {
  view: TourView;
  registerRegion: (key: string) => RegionRef;
}

interface RailSession {
  readonly kind: KindKey;
  readonly goal: string;
  readonly sub?: string;
  readonly cost: string;
  readonly state: 'active' | 'running' | 'pending' | 'idle';
}

const RAIL_SESSIONS: ReadonlyArray<RailSession> = [
  { kind: 'imple', goal: 'Add password reset', sub: 'AUTH-142', cost: '$0.34', state: 'active' },
  {
    kind: 'debug',
    goal: 'Fix flaky checkout webhook test',
    sub: 'PAY-77',
    cost: '$0.18',
    state: 'running',
  },
  { kind: 'review', goal: 'Review PR #214 (rate limiter)', cost: '$0.09', state: 'pending' },
  { kind: 'scout', goal: 'Map every transactional email', cost: '$0.03', state: 'idle' },
  {
    kind: 'docs',
    goal: 'Document the reset endpoint',
    sub: 'AUTH-149',
    cost: '$0.02',
    state: 'idle',
  },
  { kind: 'plan', goal: 'Plan legacy cookie migration', cost: '$0.07', state: 'idle' },
];

const STATE_DOT: Record<RailSession['state'], string> = {
  active: 'bg-primary',
  running: 'bg-info',
  pending: 'bg-warning',
  idle: 'bg-muted-foreground/40',
};

export function AppCanvas({ view, registerRegion }: CanvasProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
      <TopBar autoRun={view.autoRun} />
      <div className="flex min-h-0 flex-1">
        <Rail registerRegion={registerRegion} />
        <Chat view={view} registerRegion={registerRegion} />
        <RightPanel view={view} registerRegion={registerRegion} />
      </div>
    </div>
  );
}

function TopBar({ autoRun }: { autoRun: boolean }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border-soft bg-subtle px-3.5">
      <div className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-danger/80" />
        <span className="size-3 rounded-full bg-warning/80" />
        <span className="size-3 rounded-full bg-success/80" />
      </div>
      <span className="text-[12px] font-semibold tracking-tight text-foreground">Goodboy</span>
      <span className="text-border">/</span>
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <IconBranch size={11} /> {PR.branch}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors',
            autoRun
              ? 'border-primary/50 bg-primary/15 text-primary'
              : 'border-border-soft text-muted-foreground',
          ].join(' ')}
        >
          <span
            className={[
              'size-1.5 rounded-full',
              autoRun ? 'bg-primary pulse' : 'bg-muted-foreground/40',
            ].join(' ')}
          />
          Autorun {autoRun ? 'on' : 'off'}
        </span>
        <span className="rounded-md border border-border-soft px-2 py-1 font-mono text-[10.5px] text-muted-foreground">
          $0.34
        </span>
      </div>
    </div>
  );
}

function Rail({ registerRegion }: { registerRegion: (key: string) => RegionRef }) {
  return (
    <div
      ref={registerRegion('rail')}
      className="flex w-[248px] shrink-0 flex-col border-r border-border-soft bg-subtle"
    >
      <div className="flex h-9 items-center justify-between border-b border-border-soft px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sessions
        </span>
        <IconPlus size={12} className="text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1 p-2">
        {RAIL_SESSIONS.map((s, i) => (
          <SessionRow key={s.goal} session={s} active={i === 0} />
        ))}
      </div>
    </div>
  );
}

function SessionRow({ session, active }: { session: RailSession; active: boolean }) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/40',
      ].join(' ')}
    >
      <span className={['size-1.5 shrink-0 rounded-full', STATE_DOT[session.state]].join(' ')} />
      <AgentAvatar kind={KIND[session.kind].kind} size={13} />
      <span
        className={[
          'min-w-0 flex-1 truncate text-[11px]',
          active ? 'font-semibold text-foreground' : 'text-foreground/75',
        ].join(' ')}
      >
        {session.goal}
      </span>
      {session.sub ? (
        <span className="shrink-0 rounded bg-muted px-1 font-mono text-[8.5px] text-muted-foreground">
          {session.sub}
        </span>
      ) : null}
    </div>
  );
}

function Chat({ view, registerRegion }: CanvasProps) {
  const shown = CHAT_TURNS.slice(0, view.chatCount);
  const showDock = view.act === 5 && view.chatCount >= 4;
  return (
    <div ref={registerRegion('chat')} className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-soft px-4">
        <AgentAvatar kind="implementer" size={16} />
        <span className="text-[12.5px] font-semibold text-foreground">Add password reset</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          AUTH-142
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-info pulse" /> working
        </span>
      </div>

      <Pipeline steps={view.steps} />

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 py-3">
        {shown.map((turn) => (
          <ChatBubble key={turn.id} role={turn.role} kind={turn.kind} text={turn.text} />
        ))}
        {showDock ? <ClusterDock clusters={view.clusters} /> : null}
      </div>

      <div className="flex h-[52px] shrink-0 items-center gap-2 border-t border-border-soft px-4">
        <div className="flex flex-1 items-center rounded-lg border border-border-soft bg-subtle px-3 py-2 text-[11px] text-muted-foreground/60">
          Message Goodboy
        </div>
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <IconArrowUpGlyph />
        </span>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  kind,
  text,
}: {
  role: 'user' | 'agent';
  kind?: KindKey;
  text: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
          {text}
        </div>
      </div>
    );
  }
  const k = kind ?? 'generic';
  return (
    <div className="flex items-start gap-2">
      <span
        className={['mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', KIND[k].bg].join(
          ' ',
        )}
      >
        <AgentAvatar kind={KIND[k].kind} size={14} tint="bg-zinc-950/80" />
      </span>
      <div className="min-w-0">
        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {KIND[k].label}
        </span>
        <div className="rounded-2xl rounded-tl-sm border border-border-soft bg-subtle px-3 py-2 text-[11.5px] leading-relaxed text-foreground/90">
          {text}
        </div>
      </div>
    </div>
  );
}

function Pipeline({ steps }: { steps: StepStatus[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border-soft bg-subtle/60 px-4 py-2">
      {RUN_STEPS.map((step, i) => (
        <div key={step.name} className="flex min-w-0 flex-1 items-center gap-1">
          <StepPill kind={step.kind} status={steps[i]} index={i} />
          {i < RUN_STEPS.length - 1 ? (
            <span
              className={[
                'h-px w-3 shrink-0',
                steps[i] === 'done' ? 'bg-primary/50' : 'bg-border-soft',
              ].join(' ')}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StepPill({ kind, status, index }: { kind: KindKey; status: StepStatus; index: number }) {
  const done = status === 'done';
  const running = status === 'running';
  const actionable = status === 'actionable';
  return (
    <div
      className={[
        'flex min-w-0 flex-1 items-center gap-1 rounded-md border px-1.5 py-1 transition-colors',
        running
          ? 'border-info/60 bg-info/10'
          : done
            ? 'border-primary/40 bg-primary/10'
            : actionable
              ? 'border-primary/50 bg-primary/10'
              : 'border-border-soft/60 bg-transparent',
      ].join(' ')}
    >
      <StatusGlyph status={status} index={index} />
      <span
        className={[
          'min-w-0 flex-1 truncate text-[9.5px] font-medium',
          done || running
            ? 'text-foreground/85'
            : actionable
              ? 'text-primary'
              : 'text-muted-foreground/45',
        ].join(' ')}
      >
        {KIND[kind].label}
      </span>
    </div>
  );
}

function StatusGlyph({ status, index }: { status: StepStatus; index: number }) {
  if (status === 'done')
    return (
      <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <IconCheck size={9} />
      </span>
    );
  if (status === 'running') return <Spinner />;
  if (status === 'actionable')
    return <span className="size-3.5 shrink-0 rounded-full border border-primary/60" />;
  return (
    <span className="grid size-3.5 shrink-0 place-items-center font-mono text-[8px] text-muted-foreground/40">
      {index + 1}
    </span>
  );
}

function ClusterDock({ clusters }: { clusters: StepStatus[] }) {
  return (
    <div className="rounded-xl border border-border-soft bg-subtle/70 p-2.5">
      <div className="flex items-center gap-1.5 pb-2 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <AgentAvatar kind="implementer" size={12} />3 subagents implementing
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {CLUSTERS.map((c, i) => (
          <div
            key={c}
            className={[
              'flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors',
              clusters[i] === 'done'
                ? 'border-success/40 bg-success/10'
                : clusters[i] === 'running'
                  ? 'border-info/50 bg-info/10'
                  : 'border-border-soft/60',
            ].join(' ')}
          >
            {clusters[i] === 'done' ? (
              <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-success text-zinc-950">
                <IconCheck size={9} />
              </span>
            ) : clusters[i] === 'running' ? (
              <Spinner />
            ) : (
              <span className="size-3.5 shrink-0 rounded-full border border-border-soft" />
            )}
            <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightPanel({ view, registerRegion }: CanvasProps) {
  return (
    <div
      ref={registerRegion('right')}
      className="flex w-[348px] shrink-0 flex-col border-l border-border-soft bg-subtle"
    >
      {view.rightMode === 'github' ? <GithubPanel view={view} /> : <ContextPanel view={view} />}
    </div>
  );
}

const CTX_TABS: ReadonlyArray<{
  key: 'context' | 'plans' | 'questions' | 'terminal';
  label: string;
  icon: typeof IconList;
}> = [
  { key: 'context', label: 'Context', icon: IconList },
  { key: 'plans', label: 'Plans', icon: IconClipboard },
  { key: 'questions', label: 'Questions', icon: IconHelp },
  { key: 'terminal', label: 'Terminal', icon: IconTerminal },
];

function ContextPanel({ view }: { view: TourView }) {
  const activeTab = view.rightMode === 'plans' ? 'plans' : 'context';
  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border-soft px-1.5">
        {CTX_TABS.map((t) => {
          const on = t.key === activeTab;
          const Icon = t.icon;
          return (
            <span
              key={t.key}
              className={[
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/70',
              ].join(' ')}
            >
              <Icon size={11} /> {t.label}
            </span>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'plans' ? <PlansBody show={view.planShown} /> : <ContextBody view={view} />}
      </div>
    </>
  );
}

function ContextBody({ view }: { view: TourView }) {
  const decisions = DECISIONS.slice(0, view.decisions);
  return (
    <div className="flex flex-col gap-3 p-3">
      <SlotCard tone="primary" icon={<IconTarget size={12} />} label="goal">
        <p className="text-[11px] leading-relaxed text-foreground/85">{SESSION_GOAL}</p>
      </SlotCard>

      <SlotCard
        tone="success"
        icon={<IconCheck size={12} />}
        label={`decisions · ${view.decisions}`}
      >
        <div className="flex flex-col gap-1">
          {decisions.map((d) => (
            <p key={d} className="text-[10.5px] leading-snug text-foreground/80">
              <span className="text-success">+</span> {d}
            </p>
          ))}
          {view.decisions === 0 ? (
            <p className="text-[10.5px] italic text-muted-foreground/50">none yet</p>
          ) : null}
        </div>
      </SlotCard>

      {view.questionShown ? (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5">
          <div className="flex items-center gap-1.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-warning">
            <IconHelp size={11} /> open question
          </div>
          <p className="pb-2 text-[11px] leading-relaxed text-foreground/85">{OPEN_QUESTION}</p>
          <div className="flex flex-wrap gap-1.5">
            {QUESTION_SUGGESTIONS.map((s, i) => (
              <span
                key={s}
                className={[
                  'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                  view.questionPicked === i
                    ? 'border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'border-border/50 bg-muted/40 text-muted-foreground',
                ].join(' ')}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlotCard({
  tone,
  icon,
  label,
  children,
}: {
  tone: 'primary' | 'success' | 'info';
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const ring =
    tone === 'primary'
      ? 'border-primary/30'
      : tone === 'success'
        ? 'border-success/30'
        : 'border-info/30';
  const text =
    tone === 'primary' ? 'text-primary' : tone === 'success' ? 'text-success' : 'text-info';
  return (
    <div className={['rounded-md border bg-background/40 p-2.5', ring].join(' ')}>
      <div
        className={[
          'flex items-center gap-1.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-wide',
          text,
        ].join(' ')}
      >
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function PlansBody({ show }: { show: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="rounded-md border border-border-soft bg-background/40 p-2.5">
        <div className="flex items-center gap-2 pb-1.5">
          <IconClipboard size={11} className="text-muted-foreground" />
          <span className="text-[11.5px] font-semibold text-foreground">{PLAN.title}</span>
          <span className="ml-auto rounded bg-warning/15 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-warning">
            active
          </span>
        </div>
        <ol className="flex flex-col gap-1 pl-1">
          {PLAN.steps.map((s, i) => (
            <li key={s} className="flex gap-1.5 text-[10.5px] leading-snug text-foreground/80">
              <span className="font-mono text-muted-foreground/50">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      {show ? (
        <div className="rounded-md border border-info/30 bg-info/5 p-2.5">
          <div className="flex items-center gap-2 pb-1">
            <IconClipboard size={11} className="text-info" />
            <span className="text-[11.5px] font-semibold text-foreground/90">
              {PLAN.consumed.title}
            </span>
            <span className="ml-auto rounded bg-info/15 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-info">
              consumed
            </span>
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">{PLAN.consumed.note}</p>
        </div>
      ) : null}
    </div>
  );
}

function GithubPanel({ view }: { view: TourView }) {
  const phase = view.ghPhase;
  const merged = phase === 'merged';
  const resolved = phase === 'resolved' || merged;
  const committed = phase === 'committed' || resolved;
  const resolving = phase === 'resolving' || committed;
  const canMerge = resolved && !merged;
  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border-soft px-3">
        <span className="font-mono text-[10px] text-muted-foreground">#{PR.num}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
          {PR.title}
        </span>
        <span className={['shrink-0', merged ? 'chip chip-merged' : 'chip chip-success'].join(' ')}>
          {merged ? 'merged' : 'open'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border-soft px-3 py-2">
        <span
          className={[
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
            merged
              ? 'border-merged/40 bg-merged/10 text-merged'
              : canMerge
                ? 'border-success bg-success text-zinc-950'
                : 'border-border-soft text-muted-foreground/40',
          ].join(' ')}
        >
          <IconCheck size={10} /> {merged ? 'Merged' : 'Merge'}
        </span>
        {!merged ? (
          <span className="rounded-md border border-border-soft px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Close
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground/60">
          <IconBranch size={9} /> {PR.branch}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
        <div className="rounded-md border border-border-soft bg-background/40 p-2.5">
          <div className="flex items-center gap-1.5 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="grid size-4 place-items-center rounded-full bg-cyan-400 text-zinc-950">
              <AgentAvatar kind="reviewer" size={10} tint="bg-zinc-950/80" />
            </span>
            review
          </div>
          <p className="text-[11px] leading-relaxed text-foreground/85">{PR.comment}</p>
        </div>

        {resolving ? (
          <div
            className={[
              'rounded-md border p-2.5 transition-colors',
              resolved ? 'border-success/40 bg-success/5' : 'border-info/40 bg-info/5',
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/85">
              {committed ? (
                <span className="grid size-4 place-items-center rounded-full bg-success text-zinc-950">
                  <IconCheck size={10} />
                </span>
              ) : (
                <Spinner />
              )}
              {resolved
                ? 'Resolved by commit'
                : committed
                  ? 'Committed the fix'
                  : 'Resolve agent working'}
            </div>
            {committed ? (
              <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
                <IconCheck size={9} className="text-success" /> {PR.sha}
                <span className="text-muted-foreground/60">argon2id hashing</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 text-[9.5px] text-muted-foreground/60">
          <IconCheck size={9} className="text-success" /> 4 checks passed
        </div>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <span className="inline-grid size-3.5 shrink-0 place-items-center" aria-hidden>
      <span className="size-3 animate-spin rounded-full border-[1.5px] border-info/30 border-t-info" />
    </span>
  );
}

function IconArrowUpGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 13V3M8 3L4 7M8 3l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
