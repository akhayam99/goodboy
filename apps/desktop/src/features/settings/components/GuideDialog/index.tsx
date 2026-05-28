import { useState, type ReactNode } from 'react';
import { Button, Dialog, cn } from '@goodboy/ui';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import {
  ArrowRight,
  BookOpen,
  Coins,
  FolderGit2,
  GitBranch,
  Lightbulb,
  MessageSquare,
  MessagesSquare,
  Palette,
  Sparkles,
  Workflow,
  Wrench,
} from 'lucide-react';
import { DogMascot } from '../../../../shared/components/DogMascot';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section = 'overview' | 'session' | 'turn' | 'tools' | 'tokens' | 'agents' | 'tips' | 'legenda';

interface NavItem {
  readonly id: Section;
  readonly label: string;
  readonly icon: ReactNode;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'overview', label: 'Overview', icon: <BookOpen size={13} aria-hidden /> },
  { id: 'session', label: 'Sessions', icon: <GitBranch size={13} aria-hidden /> },
  { id: 'turn', label: 'Turns', icon: <MessagesSquare size={13} aria-hidden /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={13} aria-hidden /> },
  { id: 'tokens', label: 'Tokens & cost', icon: <Coins size={13} aria-hidden /> },
  { id: 'agents', label: 'Agents', icon: <DogMascot size={13} /> },
  { id: 'tips', label: 'Tips', icon: <Lightbulb size={13} aria-hidden /> },
  { id: 'legenda', label: 'Legend', icon: <Palette size={13} aria-hidden /> },
];

export function GuideDialog({ open, onClose }: Props) {
  const [active, setActive] = useState<Section>('overview');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Getting started"
      description="How Goodboy, sessions, agents, and CLI providers fit together."
      size="xl"
      className="w-[64rem] max-w-[95vw]"
      bodyClassName="px-0 py-0 gap-0"
      fixedHeightClass="h-[720px]"
      fullScreenOnSmall
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex h-full min-h-0">
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-border-soft bg-subtle/40 px-3 py-5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                'relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                active === item.id
                  ? 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <Content section={active} onJump={setActive} />
        </div>
      </div>
    </Dialog>
  );
}

function Content({ section, onJump }: { section: Section; onJump: (s: Section) => void }) {
  switch (section) {
    case 'overview':
      return <OverviewSection onJump={onJump} />;
    case 'session':
      return <SessionsSection />;
    case 'turn':
      return <TurnsSection />;
    case 'tools':
      return <ToolsSection />;
    case 'tokens':
      return <TokensSection />;
    case 'agents':
      return <AgentsSection />;
    case 'tips':
      return <TipsSection />;
    case 'legenda':
      return <LegendSection />;
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* Sections                                                              */
/* ──────────────────────────────────────────────────────────────────── */

function OverviewSection({ onJump }: { onJump: (s: Section) => void }) {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<BookOpen size={14} aria-hidden className="text-primary" />}
        title="What is Goodboy?"
        subtitle={
          SESSION_FEATURES.budget
            ? 'Goodboy orchestrates AI coding CLIs (Claude, cursor-agent, Codex) so you can run multiple agents in parallel against your repo, with budget caps, audit logs, and structured workflows.'
            : 'Goodboy orchestrates AI coding CLIs (Claude, cursor-agent, Codex) so you can run multiple agents in parallel against your repo, with audit logs and structured workflows.'
        }
        accent="primary"
      />

      <Callout tone="info" icon={<Sparkles size={13} />}>
        Goodboy does <strong className="text-foreground">not</strong> talk to AI providers directly.
        It spawns the provider's CLI as a subprocess and streams events. Your usage, login, and
        quotas live in the CLI itself, Goodboy just adds the workspace layer on top.
      </Callout>

      <div>
        <Eyebrow>Mental model</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ConceptCard
            icon={<FolderGit2 size={14} aria-hidden />}
            tone="primary"
            label="Workspace"
            body="A git repo on disk. You can connect many."
            onClick={() => onJump('session')}
          />
          <ConceptCard
            icon={<GitBranch size={14} aria-hidden />}
            tone="success"
            label="Session"
            body="A chat with one goal, on its own git worktree + branch. Like a feature branch with built-in chat."
            onClick={() => onJump('session')}
          />
          <ConceptCard
            icon={<DogMascot size={14} />}
            tone="warning"
            label="Agent"
            body="One provider/CLI invocation inside a session. A session may host several agents (planning, coding, review…)."
            onClick={() => onJump('agents')}
          />
          <ConceptCard
            icon={<MessageSquare size={14} aria-hidden />}
            tone="info"
            label="Turn"
            body="A single user → assistant exchange inside an agent. Tools called inside count as the same turn."
            onClick={() => onJump('turn')}
          />
        </div>
      </div>
    </div>
  );
}

function SessionsSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<GitBranch size={14} aria-hidden className="text-success" />}
        title="Sessions"
        subtitle="One focused unit of work. Owns a git worktree, a branch, transcripts, and a goal."
        accent="success"
      />

      <Block title="What gets created">
        <DefinitionList
          rows={[
            {
              term: 'worktree',
              desc: 'A separate working directory cut from your repo root.',
              icon: <FolderGit2 size={11} aria-hidden />,
              tone: 'primary',
            },
            {
              term: 'branch',
              desc: 'kay/<slug> (or your prefix), derived from the goal. Configurable per workspace.',
              icon: <GitBranch size={11} aria-hidden />,
              tone: 'success',
            },
            {
              term: 'transcript',
              desc: 'Every user message, assistant reply, tool call, and edit is stored.',
              icon: <MessagesSquare size={11} aria-hidden />,
              tone: 'info',
            },
            ...(SESSION_FEATURES.budget
              ? [
                  {
                    term: 'budget (optional)',
                    desc: 'Soft cap in USD. Warning at 80%, error at 100%. Session keeps running.',
                    icon: <Coins size={11} aria-hidden />,
                    tone: 'warning' as const,
                  },
                ]
              : []),
          ]}
        />
      </Block>

      <Block title="When to start a new session">
        <DefinitionList
          rows={[
            {
              term: 'Goal shifts',
              desc: 'If the task changes meaningfully, a new session is cheaper than steering an old one off-track.',
            },
            {
              term: 'Context bloat',
              desc: 'Context window getting close to full → start fresh. Transferring the relevant decisions takes seconds; fighting a saturated agent costs more.',
            },
            {
              term: 'Parallel exploration',
              desc: 'Two ways to solve the same problem? Spin two sessions, compare.',
            },
          ]}
        />
      </Block>

      <Block title="Archive vs delete">
        <div className="grid grid-cols-2 gap-3">
          <Tile tone="success" label="Archive">
            Hides from the active list, keeps the worktree, transcripts, and audit. Reversible.
          </Tile>
          <Tile tone="danger" label="Delete">
            Removes everything irreversibly. When in doubt, archive.
          </Tile>
        </div>
      </Block>
    </div>
  );
}

function TurnsSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<MessagesSquare size={14} aria-hidden className="text-info" />}
        title="Turns"
        subtitle="One user message + the assistant's full response (which may include many tool calls and edits)."
        accent="info"
      />

      <Block title="How turns are counted">
        <DefinitionList
          rows={[
            {
              term: 'user → assistant',
              desc: 'Each user message you send is one turn. The count in the chat header reflects that.',
            },
            {
              term: 'tools inside a turn',
              desc: 'When the agent calls grep, edit, run, etc., those are part of the same turn, not separate ones.',
            },
            {
              term: 'queueing',
              desc: 'While a turn is running you can still type. Hitting send queues the message and it fires automatically when the current turn ends.',
            },
          ]}
        />
      </Block>

      <Callout tone="info" icon={<Lightbulb size={13} />}>
        Providers bill per token across the whole conversation, not per turn. But from a UX angle,
        "I've sent 14 turns and we still don't have a working build" is a useful drift signal, time
        to start a new session.
      </Callout>
    </div>
  );
}

function ToolsSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Wrench size={14} aria-hidden className="text-warning" />}
        title="Tools"
        subtitle="Actions the agent takes outside of just talking: reading files, running shell commands, editing code, fetching docs."
        accent="warning"
      />

      <Block title="How they show up">
        <p className="text-sm leading-relaxed text-muted-foreground">
          In the transcript, each tool invocation collapses to a single row (
          <InlineCode>Bash</InlineCode>, <InlineCode>Read</InlineCode>,{' '}
          <InlineCode>Edit</InlineCode>…). Click to expand input/output. Consecutive tool rows are
          visually grouped to keep the chat readable.
        </p>
      </Block>

      <Block title="Permissions">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Goodboy proxies the CLI's permission system. Above the input you see{' '}
          <InlineCode>permissions: X allow / Y deny</InlineCode>, the rule set the next turn will
          run under. Click it to manage rules in settings.
        </p>
      </Block>

      {WORKSPACE_FEATURES.skills ? (
        <Block title="Skills">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Type <InlineCode>/</InlineCode> in the input to invoke a workspace skill, a pre-defined
            prompt template stored in <InlineCode>.kay/skills/</InlineCode> or{' '}
            <InlineCode>.claude/skills/</InlineCode>. Useful for repeatable flows: release notes,
            security reviews, migration plans.
          </p>
        </Block>
      ) : null}
    </div>
  );
}

function TokensSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Coins size={14} aria-hidden className="text-amber-400" />}
        title="Tokens & cost"
        subtitle="Every message, yours and the assistant's, is converted into tokens before billing. Roughly 1 token ≈ ¾ of an English word."
        accent="warning"
      />

      <Block title="Input vs output">
        <DefinitionList
          rows={[
            {
              term: 'input tokens',
              desc: 'Everything sent into the model: system prompt, conversation history, tool results, your latest message. Grows every turn, that is why later turns cost more even if your message is short.',
            },
            {
              term: 'cached input tokens',
              desc: 'Portions of the prompt the provider can reuse from a recent call (Anthropic prompt cache). Billed at ~10% of input rate. Green numbers in the pricing dialog.',
            },
            {
              term: 'output tokens',
              desc: 'What the model writes back: text + tool calls. The most expensive category (5–15× input rate).',
            },
          ]}
        />
      </Block>

      <Block title="Context window">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each model has a hard ceiling on how many tokens fit in one call (Opus 4.7 1M, Sonnet 4.6
          / Haiku 4.5 200k, gpt-4o 128k). The bar under each agent shows how full the current
          context is. Above 75% → the agent starts forgetting; consider summarizing or starting a
          new session.
        </p>
      </Block>

      <Block title="Cost colors">
        <div className="grid grid-cols-3 gap-3">
          <Tile tone="success" label="Cheap" mono>
            haiku, cursor-small.
            <br />
            Good for grep-heavy / planning steps.
          </Tile>
          <Tile tone="warning" label="Mid" mono>
            sonnet, gpt-4o.
            <br />
            Default for most coding work.
          </Tile>
          <Tile tone="danger" label="Premium" mono>
            opus.
            <br />
            Reserve for hard reasoning, refactors, last-resort fixes.
          </Tile>
        </div>
        <p className="mt-3 text-2xs leading-relaxed text-muted-foreground/70">
          The picker sorts <strong className="font-semibold text-foreground">cheapest first</strong>{' '}
          on purpose. Switching down a tier often costs nothing in quality on routine tasks.
        </p>
      </Block>
    </div>
  );
}

function AgentsSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<DogMascot size={14} className="text-warning" />}
        title="Agents"
        subtitle="One provider invocation inside a session. A session can host multiple agents, same provider or different ones."
        accent="warning"
      />

      <Block title="Why multiple agents per session">
        <DefinitionList
          rows={[
            {
              term: 'Role separation',
              desc: 'Spawn a planning agent on Opus, then a coding agent on Sonnet. Each keeps its own transcript.',
              icon: <Workflow size={11} aria-hidden />,
              tone: 'primary',
            },
            {
              term: 'Workflow steps',
              desc: 'A workflow defines ordered steps (plan → implement → done). Each step spawns an agent with its own model + system prompt.',
              icon: <ArrowRight size={11} aria-hidden />,
              tone: 'success',
            },
            {
              term: 'Parallel exploration',
              desc: 'Two agents on the same goal, diff their results, pick the better diff at merge time.',
              icon: <Sparkles size={11} aria-hidden />,
              tone: 'info',
            },
          ]}
        />
      </Block>

      <Block title="Reading the agent row">
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/50 p-4 text-xs">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Second line of each agent
          </span>
          <div className="flex flex-wrap items-center gap-2 font-mono text-foreground">
            <Chip tone="primary">model</Chip>
            <span className="text-muted-foreground/40">·</span>
            <Chip tone="info">↓ input</Chip>
            <span className="text-muted-foreground/40">·</span>
            <Chip tone="warning">↑ output</Chip>
            <span className="text-muted-foreground/40">·</span>
            <Chip tone="success">cost</Chip>
            <span className="text-muted-foreground/40">·</span>
            <Chip tone="muted">⏱ age</Chip>
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Below that line, a thin bar = context window utilization. Hover for exact numbers.
          </p>
        </div>
      </Block>
    </div>
  );
}

function TipsSection() {
  const tips: ReadonlyArray<{ title: string; body: string }> = [
    {
      title: 'Pin one short goal per session',
      body: 'Long open-ended sessions drift. When scope creeps, spin a new one and link via context.',
    },
    {
      title: 'Set a soft cap',
      body: 'Even a generous one. It forces a pause before a runaway agent burns $20 on a bad assumption.',
    },
    {
      title: 'Use cheap models for navigation',
      body: 'Haiku / cursor-small can grep, list, summarize in seconds at 1/15th the price. Swap up only when reasoning gets hard.',
    },
    {
      title: "Queue, don't cancel",
      body: "If the agent is mid-tool and you have a follow-up, type it: it'll queue. Cancelling mid-turn loses the partial work.",
    },
    {
      title: 'Archive freely',
      body: 'Archive is reversible. The only irreversible move is delete, and you have to confirm twice.',
    },
    {
      title: 'Restart on CLI upgrades',
      body: 'When you update the underlying CLI (claude / cursor-agent / codex), restart Goodboy so it re-detects versions and auth.',
    },
  ];
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Lightbulb size={14} aria-hidden className="text-amber-400" />}
        title="Tips"
        subtitle="Patterns that compound across sessions."
        accent="warning"
      />
      <div className="grid grid-cols-2 gap-3">
        {tips.map((t, i) => (
          <div
            key={t.title}
            className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle/40 p-4 transition-colors hover:border-border hover:bg-subtle/60"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/15 font-mono text-[10px] font-semibold text-amber-400">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-foreground">{t.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendSection() {
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Palette size={14} aria-hidden className="text-primary" />}
        title="Legend"
        subtitle="Color meanings used throughout the interface."
        accent="primary"
      />

      <LegendBlock title="Agent status, workflow steps">
        <LegendaGrid
          rows={[
            { dot: 'bg-muted-foreground/50', label: 'pending', desc: 'not yet started' },
            { dot: 'bg-info', label: 'running', desc: 'active turn in progress' },
            { dot: 'bg-success', label: 'completed', desc: 'ended successfully' },
            { dot: 'bg-danger', label: 'failed', desc: 'ended with error' },
            {
              dot: 'bg-muted-foreground/30',
              label: 'skipped',
              desc: 'bypassed by workflow logic',
            },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Session & workspace cards, border signals">
        <LegendaGrid
          rows={[
            {
              dot: 'bg-warning animate-soft-pulse',
              label: 'pending attention',
              desc: 'amber pulse, agent replied or workspace has unread activity',
            },
            {
              dot: 'bg-info',
              label: 'running',
              desc: 'info border, a turn is active in this session',
            },
            {
              dot: 'bg-danger',
              label: 'errored',
              desc: 'danger border, the last turn ended with an error',
            },
            {
              dot: 'bg-transparent ring-1 ring-border-soft',
              label: 'idle',
              desc: 'no border accent, nothing needs your attention',
            },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Edit types, transcript">
        <LegendaGrid
          rows={[
            { dot: 'bg-primary', label: 'create', desc: 'new file or resource added' },
            { dot: 'bg-muted-foreground/60', label: 'modify', desc: 'existing file changed' },
            { dot: 'bg-danger', label: 'delete', desc: 'file or resource removed' },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Context window, CTX fill level">
        <LegendaGrid
          rows={[
            { dot: 'bg-success', label: '< 50%', desc: 'comfortable: plenty of context remaining' },
            { dot: 'bg-info', label: '50–75%', desc: 'moderate: monitor closely' },
            { dot: 'bg-warning', label: '75–90%', desc: 'high: consider summarizing soon' },
            { dot: 'bg-danger', label: '≥ 90%', desc: 'critical: start a new session' },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Verbosity, output density">
        <LegendaGrid
          rows={[
            { dot: 'bg-success', label: 'brief', desc: 'bare minimum: one-liners only' },
            { dot: 'bg-info', label: 'normal', desc: 'standard prose with rationale' },
            { dot: 'bg-danger', label: 'verbose', desc: 'full long-form with alternatives' },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Permission mode, tool access">
        <LegendaGrid
          rows={[
            { dot: 'bg-danger', label: 'bypass', desc: 'all tools used freely, no prompts' },
            { dot: 'bg-warning', label: 'edits', desc: 'file edits allowed; bash asks first' },
            { dot: 'bg-blue-500', label: 'default', desc: 'writes and runs ask for approval' },
            { dot: 'bg-slate-400', label: 'plan', desc: 'no tool calls executed, read-only' },
          ]}
        />
      </LegendBlock>

      <LegendBlock title="Auto badge">
        <LegendaGrid
          rows={[
            {
              dot: 'bg-amber-400',
              label: 'AUTO',
              desc: 'autorun mode: next action fires without user confirmation',
            },
          ]}
        />
      </LegendBlock>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Building blocks                                                       */
/* ──────────────────────────────────────────────────────────────────── */

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
};

const TONE_FG: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

const TONE_BORDER: Record<Tone, string> = {
  primary: 'border-primary/20',
  success: 'border-success/20',
  warning: 'border-warning/20',
  danger: 'border-danger/20',
  info: 'border-info/20',
  muted: 'border-border-soft',
};

function SectionHeader({
  icon,
  title,
  subtitle,
  accent = 'primary',
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent?: Tone;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className={cn('flex h-8 w-8 items-center justify-center rounded-md', TONE_BG[accent])}
        >
          {icon}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
      {children}
    </span>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

function LegendBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border-soft bg-subtle/40 p-4">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

function Callout({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed text-muted-foreground',
        TONE_BG[tone],
        TONE_BORDER[tone],
      )}
    >
      <span className={cn('mt-0.5 shrink-0', TONE_FG[tone])}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function ConceptCard({
  icon,
  tone,
  label,
  body,
  onClick,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  body: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-lg border border-border-soft bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md',
          TONE_BG[tone],
          TONE_FG[tone],
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{body}</span>
    </button>
  );
}

interface DefinitionRow {
  readonly term: string;
  readonly desc: string;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
}

function DefinitionList({ rows }: { rows: ReadonlyArray<DefinitionRow> }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.term}
          className="flex items-start gap-3 rounded-md border border-border-soft bg-subtle/40 px-3 py-2.5"
        >
          {row.icon ? (
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                TONE_BG[row.tone ?? 'muted'],
                TONE_FG[row.tone ?? 'muted'],
              )}
            >
              {row.icon}
            </span>
          ) : (
            <span
              className={cn(
                'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                TONE_FG[row.tone ?? 'muted'].replace('text-', 'bg-'),
              )}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{row.term}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{row.desc}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Tile({
  tone,
  label,
  mono,
  children,
}: {
  tone: Tone;
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border p-3.5',
        TONE_BG[tone],
        TONE_BORDER[tone],
      )}
    >
      <span className={cn('text-xs font-semibold uppercase tracking-wide', TONE_FG[tone])}>
        {label}
      </span>
      <span className={cn('text-xs leading-relaxed text-muted-foreground', mono && 'font-mono')}>
        {children}
      </span>
    </div>
  );
}

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium',
        TONE_BG[tone],
        TONE_FG[tone],
      )}
    >
      {children}
    </span>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

interface LegendaRow {
  readonly dot: string;
  readonly label: string;
  readonly desc: string;
}

function LegendaGrid({ rows }: { rows: ReadonlyArray<LegendaRow> }) {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', row.dot)}
          />
          <span className="w-24 shrink-0 text-sm font-medium text-foreground">{row.label}</span>
          <span className="text-sm text-muted-foreground">{row.desc}</span>
        </li>
      ))}
    </ul>
  );
}
