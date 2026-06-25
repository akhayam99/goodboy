import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn, Divider, ScrollFade } from '@goodboy/ui'
import {
  ArrowRight,
  BookOpen,
  Coins,
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  MessagesSquare,
  Network,
  Palette,
  Sparkles,
  Workflow,
  Wrench,
} from 'lucide-react'
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features'
import { StudioShell } from '../../../../shared/components/StudioShell'
import { DogMascot } from '../../../../shared/components/DogMascot'

type Props = {
  readonly onClose: () => void
}

type Section =
  | 'overview'
  | 'board'
  | 'session'
  | 'turn'
  | 'tools'
  | 'tokens'
  | 'agents'
  | 'tips'
  | 'legenda'

type NavItem = {
  readonly id: Section
  readonly label: string
  readonly icon: ReactNode
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'overview', label: 'Overview', icon: <BookOpen size={13} aria-hidden /> },
  { id: 'board', label: 'Stage board', icon: <LayoutDashboard size={13} aria-hidden /> },
  { id: 'session', label: 'Sessions', icon: <GitBranch size={13} aria-hidden /> },
  { id: 'turn', label: 'Turns', icon: <MessagesSquare size={13} aria-hidden /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={13} aria-hidden /> },
  { id: 'tokens', label: 'Tokens & cost', icon: <Coins size={13} aria-hidden /> },
  { id: 'agents', label: 'Agents', icon: <DogMascot size={13} /> },
  { id: 'tips', label: 'Tips', icon: <Lightbulb size={13} aria-hidden /> },
  { id: 'legenda', label: 'Legend', icon: <Palette size={13} aria-hidden /> },
]

export const GuideStudio = ({ onClose }: Props) => {
  const scrollToRef = useRef<(id: Section) => void>(() => {})
  const suppressUntilRef = useRef(0)
  const [active, setActive] = useState<Section>('overview')

  const jump = (id: Section) => {
    suppressUntilRef.current = Date.now() + 700
    setActive(id)
    scrollToRef.current(id)
  }

  const onVisible = (id: Section) => {
    if (Date.now() >= suppressUntilRef.current) {
      setActive(id)
    }
  }

  return (
    <StudioShell
      icon={BookOpen}
      title="Getting started"
      workspaceName="How Goodboy fits together"
      closeLabel="close getting started"
      onClose={onClose}
    >
      {() => (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="guide sections"
            className="flex w-52 shrink-0 flex-col gap-1 bg-subtle/40 p-3"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                aria-current={active === item.id ? 'true' : undefined}
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
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <GuideContent
              onJump={jump}
              onVisible={onVisible}
              registerScrollTo={(fn) => {
                scrollToRef.current = fn
              }}
            />
          </div>
        </div>
      )}
    </StudioShell>
  )
}

type GuideContentProps = {
  readonly onJump: (s: Section) => void
  readonly onVisible: (s: Section) => void
  readonly registerScrollTo: (fn: (id: Section) => void) => void
}

const findScrollParent = (el: HTMLElement): HTMLElement | null => {
  let parent = el.parentElement
  while (parent) {
    const overflowY = getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

const GuideContent = ({ onJump, onVisible, registerScrollTo }: GuideContentProps) => {
  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  useEffect(() => {
    registerScrollTo((id) =>
      anchorsRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }, [registerScrollTo])

  useEffect(() => {
    const els = Object.values(anchorsRef.current).filter((el): el is HTMLDivElement => el != null)
    if (els.length === 0) {
      return
    }
    const root = findScrollParent(els[0]!)
    const observer = new IntersectionObserver(
      (records) => {
        const top = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = top?.target.getAttribute('data-guide-section')
        if (id) {
          onVisibleRef.current(id as Section)
        }
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const anchor = (id: Section) => (el: HTMLDivElement | null) => {
    if (el) {
      el.dataset.guideSection = id
      el.style.scrollMarginTop = '2.5rem'
    }
    anchorsRef.current[id] = el
  }

  return (
    <ScrollFade className="h-full w-full" viewportClassName="px-8 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <div ref={anchor('overview')}>
          <OverviewSection onJump={onJump} />
        </div>
        <div ref={anchor('board')}>
          <StageBoardSection />
        </div>
        <div ref={anchor('session')}>
          <SessionsSection />
        </div>
        <div ref={anchor('turn')}>
          <TurnsSection />
        </div>
        <div ref={anchor('tools')}>
          <ToolsSection />
        </div>
        <div ref={anchor('tokens')}>
          <TokensSection />
        </div>
        <div ref={anchor('agents')}>
          <AgentsSection />
        </div>
        <div ref={anchor('tips')}>
          <TipsSection />
        </div>
        <div ref={anchor('legenda')}>
          <LegendSection />
        </div>
      </div>
    </ScrollFade>
  )
}

const OverviewSection = ({ onJump }: { onJump: (s: Section) => void }) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<BookOpen size={14} aria-hidden className="text-primary" />}
      title="What is Goodboy?"
      description={
        SESSION_FEATURES.budget
          ? 'A builder cockpit for running coding agents in parallel. The home screen is a cross-session stage board: every piece of work in a workspace, grouped by what it needs from you. Chat, diff, terminal, IDE, and the studios are destinations you navigate to from there, with budget caps and audit logs along the way.'
          : 'A builder cockpit for running coding agents in parallel. The home screen is a cross-session stage board: every piece of work in a workspace, grouped by what it needs from you. Chat, diff, terminal, IDE, and the studios are destinations you navigate to from there, with audit logs along the way.'
      }
      tone="primary"
    />

    <Callout tone="info" icon={<Sparkles size={13} />}>
      Goodboy does <strong className="text-foreground">not</strong> talk to providers directly. It
      spawns each provider's own CLI as a subprocess and streams its events. Your login, usage, and
      quotas stay inside that CLI. Goodboy adds the workspace, board, and orchestration layer on
      top, provider-neutral by design.
    </Callout>

    <div>
      <Eyebrow>Mental model</Eyebrow>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ConceptCard
          icon={<LayoutDashboard size={14} aria-hidden />}
          tone="primary"
          label="Stage board"
          body="The home view. Every session in the workspace, grouped by stage: attention, running, review, building, done."
          onClick={() => onJump('board')}
        />
        <ConceptCard
          icon={<GitBranch size={14} aria-hidden />}
          tone="success"
          label="Session"
          body="One goal, on its own git worktree and branch. Open it to land in chat, then navigate to diff, terminal, IDE, or a studio."
          onClick={() => onJump('session')}
        />
        <ConceptCard
          icon={<DogMascot size={14} />}
          tone="warning"
          label="Agent"
          body="One CLI invocation inside a session. Spawn several; subagents render as a tree under their parent."
          onClick={() => onJump('agents')}
        />
        <ConceptCard
          icon={<MessageSquare size={14} aria-hidden />}
          tone="info"
          label="Turn"
          body="A single user to assistant exchange. Tool calls inside it count as the same turn. Spend is glanceable in the top bar."
          onClick={() => onJump('turn')}
        />
      </div>
    </div>
  </div>
)

const StageBoardSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<LayoutDashboard size={14} aria-hidden className="text-primary" />}
      title="Stage board"
      description="The home screen. One glance at every session in the workspace, grouped by what it needs from you right now."
      tone="primary"
    />

    <Block title="How sessions are grouped">
      <DefinitionList
        rows={[
          {
            term: 'attention',
            desc: 'An agent replied or hit a question and is waiting on you. Clear these first.',
            icon: <Sparkles size={11} aria-hidden />,
            tone: 'warning',
          },
          {
            term: 'running',
            desc: 'A turn is active. The agent is working; nothing to do but watch or queue a follow-up.',
            icon: <ArrowRight size={11} aria-hidden />,
            tone: 'info',
          },
          {
            term: 'review',
            desc: 'Work landed and is ready to read: a diff to check, a PR to look at.',
            icon: <Wrench size={11} aria-hidden />,
            tone: 'success',
          },
          {
            term: 'building / done',
            desc: 'In-progress or finished work that does not need you yet. Kept out of the way.',
            icon: <FolderGit2 size={11} aria-hidden />,
            tone: 'muted',
          },
        ]}
      />
    </Block>

    <Block title="Opening a session">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Click any card to enter that session. You land in chat by default; from there the lens
        switcher takes you to the diff, terminal, IDE, or a studio. The board stays one keystroke
        away, so you can fan out across several sessions and come back to triage.
      </p>
    </Block>

    <Callout tone="info" icon={<Lightbulb size={13} />}>
      The board is per workspace. Spend for the whole workspace stays glanceable in the top bar, so
      you never have to open a session to see what it is costing you.
    </Callout>
  </div>
)

const SessionsSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<GitBranch size={14} aria-hidden className="text-success" />}
      title="Sessions"
      description="One focused unit of work. Owns a git worktree, a branch, transcripts, and a goal. It is a card on the board until you open it."
      tone="success"
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
            desc: 'Derived from the goal, using your configured prefix. Set per workspace.',
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
                  desc: 'Soft cap in USD. Warning at 80%, error at 100%. The session keeps running.',
                  icon: <Coins size={11} aria-hidden />,
                  tone: 'warning' as const,
                },
              ]
            : []),
        ]}
      />
    </Block>

    <Block title="Navigating inside a session">
      <DefinitionList
        rows={[
          {
            term: 'chat',
            desc: "Where you land. The conversation with the session's agents.",
          },
          {
            term: 'diff',
            desc: 'Everything the session has changed on its worktree, ready to review before you ship.',
          },
          {
            term: 'terminal & IDE',
            desc: 'Drop into a shell on the worktree, or open it in your editor, without leaving the app.',
          },
          {
            term: 'studios',
            desc: 'Focused full-page surfaces (plans, runs, budget, providers) reached from the session, not the home view.',
          },
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
            desc: 'Context window getting close to full means start fresh. Transferring the relevant decisions takes seconds; fighting a saturated agent costs more.',
          },
          {
            term: 'Parallel exploration',
            desc: 'Two ways to solve the same problem? Spin two sessions, compare on the board.',
          },
        ]}
      />
    </Block>

    <Block title="Archive vs delete">
      <div className="grid grid-cols-2 gap-3">
        <Tile tone="success" label="Archive">
          Hides from the board, keeps the worktree, transcripts, and audit. Reversible.
        </Tile>
        <Tile tone="danger" label="Delete">
          Removes everything irreversibly. When in doubt, archive.
        </Tile>
      </div>
    </Block>
  </div>
)

const TurnsSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<MessagesSquare size={14} aria-hidden className="text-info" />}
      title="Turns"
      description="One user message plus the assistant's full response, which may include many tool calls and edits."
      tone="info"
    />

    <Block title="How turns are counted">
      <DefinitionList
        rows={[
          {
            term: 'user to assistant',
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
      Providers bill per token across the whole conversation, not per turn. But from a builder
      angle, "I've sent 14 turns and we still don't have a working build" is a useful drift signal:
      time to start a new session.
    </Callout>
  </div>
)

const ToolsSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<Wrench size={14} aria-hidden className="text-warning" />}
      title="Tools"
      description="Actions the agent takes beyond writing a reply: reading files, running shell commands, editing code, fetching docs."
      tone="warning"
    />

    <Block title="How they show up">
      <p className="text-sm leading-relaxed text-muted-foreground">
        In the transcript, each tool invocation collapses to a single row (
        <InlineCode>Bash</InlineCode>, <InlineCode>Read</InlineCode>, <InlineCode>Edit</InlineCode>
        ). Click to expand input and output. Consecutive tool rows are visually grouped to keep the
        chat readable.
      </p>
    </Block>

    <Block title="Permissions">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Goodboy proxies the CLI's own permission system. Above the input you see{' '}
        <InlineCode>permissions: X allow / Y deny</InlineCode>, the rule set the next turn will run
        under. Click it to manage rules in settings.
      </p>
    </Block>

    {WORKSPACE_FEATURES.skills ? (
      <Block title="Skills">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Type <InlineCode>/</InlineCode> in the input to invoke a workspace skill, a pre-defined
          prompt template stored alongside your repo. Useful for repeatable flows: release notes,
          security reviews, migration plans.
        </p>
      </Block>
    ) : null}
  </div>
)

const TokensSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<Coins size={14} aria-hidden className="text-warning" />}
      title="Tokens & cost"
      description="Every message, yours and the assistant's, is converted into tokens before billing. Roughly 1 token is about three quarters of an English word."
      tone="warning"
    />

    <Block title="Input vs output">
      <DefinitionList
        rows={[
          {
            term: 'input tokens',
            desc: 'Everything sent into the model: system prompt, conversation history, tool results, your latest message. Grows every turn, which is why later turns cost more even when your message is short.',
          },
          {
            term: 'cached input tokens',
            desc: 'Portions of the prompt the provider can reuse from a recent call. Billed at a fraction of the input rate when the provider supports prompt caching.',
          },
          {
            term: 'output tokens',
            desc: 'What the model writes back: text plus tool calls. The most expensive category, several times the input rate.',
          },
        ]}
      />
    </Block>

    <Block title="Context window">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Each model has a hard ceiling on how many tokens fit in one call. The bar under each agent
        shows how full the current context is. Past roughly 75% the agent starts forgetting;
        consider summarizing or starting a new session.
      </p>
    </Block>

    <Block title="Cost colors">
      <div className="grid grid-cols-3 gap-3">
        <Tile tone="success" label="Cheap" mono>
          The lowest tier of each provider.
          <br />
          Good for grep-heavy and planning steps.
        </Tile>
        <Tile tone="warning" label="Mid" mono>
          The mid tier.
          <br />
          Default for most coding work.
        </Tile>
        <Tile tone="danger" label="Premium" mono>
          The top tier.
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
)

const AgentsSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<DogMascot size={14} className="text-warning" />}
      title="Agents"
      description="One provider invocation inside a session. A session can host multiple agents, same provider or different ones, and they nest as a tree."
      tone="warning"
    />

    <Block title="Why multiple agents per session">
      <DefinitionList
        rows={[
          {
            term: 'Role separation',
            desc: 'Spawn a planning agent on one model, then a coding agent on another. Each keeps its own transcript.',
            icon: <Workflow size={11} aria-hidden />,
            tone: 'primary',
          },
          {
            term: 'Workflow steps',
            desc: 'A workflow defines ordered steps (plan, implement, done). Each step spawns an agent with its own model and system prompt.',
            icon: <ArrowRight size={11} aria-hidden />,
            tone: 'success',
          },
          {
            term: 'Subagent trees',
            desc: 'An agent can fan out into subagents for sweeps or parallel exploration. They render as a tree under their parent, so you can follow who spawned whom.',
            icon: <Network size={11} aria-hidden />,
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
          Below that line, a thin bar shows context window utilization. Hover for exact numbers.
        </p>
      </div>
    </Block>
  </div>
)

const TipsSection = () => {
  const tips: ReadonlyArray<{ readonly title: string; readonly body: string }> = [
    {
      title: 'Triage the board top-down',
      body: 'Start with the attention group, then review, then let the running ones run. The grouping is the to-do list.',
    },
    {
      title: 'Pin one short goal per session',
      body: 'Long open-ended sessions drift. When scope creeps, spin a new one and link via context.',
    },
    {
      title: 'Use cheap models for navigation',
      body: 'The lowest tier can grep, list, and summarize in seconds at a fraction of the price. Swap up only when reasoning gets hard.',
    },
    {
      title: "Queue, don't cancel",
      body: 'If the agent is mid-tool and you have a follow-up, type it: it will queue. Cancelling mid-turn loses the partial work.',
    },
    {
      title: 'Watch spend in the top bar',
      body: 'Workspace spend is always visible up top. No need to open a session to know what it is costing.',
    },
    {
      title: 'Restart on CLI upgrades',
      body: 'When you update an underlying provider CLI, restart Goodboy so it re-detects versions and auth.',
    },
  ]
  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Lightbulb size={14} aria-hidden className="text-warning" />}
        title="Tips"
        description="Patterns that compound across sessions."
        tone="warning"
      />
      <div className="grid grid-cols-2 gap-3">
        {tips.map((t, i) => (
          <div
            key={t.title}
            className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle/40 p-4 motion-safe:transition-colors hover:border-border hover:bg-subtle/60"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 font-mono text-2xs font-semibold tabular-nums text-warning">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-foreground">{t.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const LegendSection = () => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<Palette size={14} aria-hidden className="text-primary" />}
      title="Legend"
      description="Color meanings used throughout the interface."
      tone="primary"
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

    <LegendBlock title="Stage board groups">
      <LegendaGrid
        rows={[
          {
            dot: 'bg-warning animate-soft-pulse',
            label: 'attention',
            desc: 'amber pulse, an agent replied or hit a question',
          },
          {
            dot: 'bg-info',
            label: 'running',
            desc: 'info accent, a turn is active in this session',
          },
          {
            dot: 'bg-success',
            label: 'review',
            desc: 'work landed and is ready to read or ship',
          },
          {
            dot: 'bg-transparent ring-1 ring-border-soft',
            label: 'building / done',
            desc: 'no accent, nothing needs you yet',
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
          { dot: 'bg-info', label: '50 to 75%', desc: 'moderate: monitor closely' },
          { dot: 'bg-warning', label: '75 to 90%', desc: 'high: consider summarizing soon' },
          { dot: 'bg-danger', label: '90% or more', desc: 'critical: start a new session' },
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
          { dot: 'bg-info', label: 'default', desc: 'writes and runs ask for approval' },
          {
            dot: 'bg-muted-foreground/40',
            label: 'plan',
            desc: 'no tool calls executed, read-only',
          },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Auto badge">
      <LegendaGrid
        rows={[
          {
            dot: 'bg-warning',
            label: 'AUTO',
            desc: 'autorun mode: next action fires without user confirmation',
          },
        ]}
      />
    </LegendBlock>
  </div>
)

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
}

const TONE_FG: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted-foreground',
}

const TONE_BORDER: Record<Tone, string> = {
  primary: 'border-primary/20',
  success: 'border-success/20',
  warning: 'border-warning/20',
  danger: 'border-danger/20',
  info: 'border-info/20',
  muted: 'border-border-soft',
}

const SectionHeader = ({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode
  title: string
  description: string
  tone: Tone
}) => (
  <div className="flex items-start gap-3">
    <span
      className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        TONE_BG[tone],
      )}
    >
      {icon}
    </span>
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  </div>
)

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
    {children}
  </span>
)

const Block = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3">
    <Eyebrow>{title}</Eyebrow>
    {children}
  </div>
)

const LegendBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2.5 rounded-lg border border-border-soft bg-subtle/40 p-4">
    <Eyebrow>{title}</Eyebrow>
    {children}
  </div>
)

const Callout = ({
  tone,
  icon,
  children,
}: {
  tone: Tone
  icon: ReactNode
  children: ReactNode
}) => (
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
)

const ConceptCard = ({
  icon,
  tone,
  label,
  body,
  onClick,
}: {
  icon: ReactNode
  tone: Tone
  label: string
  body: string
  onClick?: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-start gap-2 rounded-lg border border-border-soft bg-background p-4 text-left motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
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
)

type DefinitionRow = {
  readonly term: string
  readonly desc: string
  readonly icon?: ReactNode
  readonly tone?: Tone
}

const DefinitionList = ({ rows }: { rows: ReadonlyArray<DefinitionRow> }) => (
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
)

const Tile = ({
  tone,
  label,
  mono,
  children,
}: {
  tone: Tone
  label: string
  mono?: boolean
  children: ReactNode
}) => (
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
)

const Chip = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium',
      TONE_BG[tone],
      TONE_FG[tone],
    )}
  >
    {children}
  </span>
)

const InlineCode = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
    {children}
  </code>
)

type LegendaRow = {
  readonly dot: string
  readonly label: string
  readonly desc: string
}

const LegendaGrid = ({ rows }: { rows: ReadonlyArray<LegendaRow> }) => (
  <ul className="flex flex-col gap-1">
    {rows.map((row) => (
      <li key={row.label} className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', row.dot)}
        />
        <span className="w-28 shrink-0 text-sm font-medium text-foreground">{row.label}</span>
        <span className="text-sm text-muted-foreground">{row.desc}</span>
      </li>
    ))}
  </ul>
)
