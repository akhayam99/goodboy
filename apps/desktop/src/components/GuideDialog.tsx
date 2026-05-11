import { useState } from 'react';
import { Button, Dialog, cn } from '@kay-am/ui';
import { BookOpen, Bot, Coins, GitBranch, Lightbulb, MessagesSquare, Palette, Wrench } from 'lucide-react';

interface GuideDialogProps {
  open: boolean;
  onClose: () => void;
}

type Section = 'overview' | 'session' | 'turn' | 'tools' | 'tokens' | 'agents' | 'tips' | 'legenda';

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'overview', label: 'Overview', icon: <BookOpen size={14} aria-hidden /> },
  { id: 'session', label: 'Sessions', icon: <GitBranch size={14} aria-hidden /> },
  { id: 'turn', label: 'Turns', icon: <MessagesSquare size={14} aria-hidden /> },
  { id: 'tools', label: 'Tools', icon: <Wrench size={14} aria-hidden /> },
  { id: 'tokens', label: 'Tokens & cost', icon: <Coins size={14} aria-hidden /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={14} aria-hidden /> },
  { id: 'tips', label: 'Tips', icon: <Lightbulb size={14} aria-hidden /> },
  { id: 'legenda', label: 'Legenda', icon: <Palette size={14} aria-hidden /> },
];

export function GuideDialog({ open, onClose }: GuideDialogProps) {
  const [active, setActive] = useState<Section>('overview');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Getting started"
      description="how kAY.am, sessions, agents, and CLI providers fit together."
      size="xl"
      fixedHeightClass="h-[640px]"
      fullScreenOnSmall
      footer={
        <Button variant="ghost" onClick={onClose}>
          close
        </Button>
      }
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                'relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                active === item.id
                  ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto pl-4 pr-1">
          <Content section={active} />
        </div>
      </div>
    </Dialog>
  );
}

function Content({ section }: { section: Section }) {
  switch (section) {
    case 'overview':
      return (
        <Article
          heading="What is kAY.am?"
          intro="kAY.am orchestrates AI coding CLIs (claude, cursor-agent, codex) so you can run multiple agents in parallel against your repo, with budget caps, audit logs, and structured workflows."
        >
          <P>
            kAY.am does <Strong>not</Strong> talk to AI providers directly. It spawns the provider's
            CLI as a subprocess and streams events. That means: your usage, login, and quotas live
            in the CLI itself; kAY.am just adds the workspace layer on top.
          </P>
          <H3>Mental model</H3>
          <List
            items={[
              ['Workspace', 'a git repo on disk. you can connect many.'],
              [
                'Session',
                'a chat with one goal, on its own git worktree + branch. like a feature branch with built-in chat.',
              ],
              [
                'Agent',
                'one provider/CLI invocation inside a session. a session may have several agents (e.g. one for planning, one for coding).',
              ],
              [
                'Turn',
                'a single user → assistant exchange inside an agent. tools called inside count as the same turn.',
              ],
            ]}
          />
        </Article>
      );

    case 'session':
      return (
        <Article
          heading="Sessions"
          intro="a session is one focused unit of work. it owns a git worktree, a branch, transcripts, and a goal."
        >
          <H3>What gets created</H3>
          <List
            items={[
              ['worktree', 'a separate working directory cut from your repo root.'],
              ['branch', '<prefix>/<slug> derived from the goal. configurable per workspace.'],
              ['transcript', 'every user message, assistant reply, tool call, and edit is stored.'],
              [
                'budget (optional)',
                'soft cap in usd. warning at 80%, error at 100%. session keeps running.',
              ],
            ]}
          />
          <H3>When to start a new session</H3>
          <List
            items={[
              [
                'goal shifts',
                'if the task changes meaningfully, a new session is cheaper than steering an old one off-track.',
              ],
              [
                'context bloat',
                'context window getting close to full → start fresh. transferring the relevant decisions takes seconds, fighting a saturated agent costs more.',
              ],
              [
                'parallel exploration',
                'two ways to solve the same problem? spin two sessions, compare.',
              ],
            ]}
          />
          <H3>Archive vs delete</H3>
          <P>
            <Strong>archive</Strong> hides from the active list, keeps the worktree, transcripts,
            and audit. <Strong>delete</Strong> removes everything irreversibly. when in doubt,
            archive.
          </P>
        </Article>
      );

    case 'turn':
      return (
        <Article
          heading="Turns"
          intro="a turn is one user message + the assistant's full response (which may include many tool calls and edits)."
        >
          <H3>How turns are counted</H3>
          <List
            items={[
              [
                'user → assistant',
                'each user message you send is one turn. the count in the chat header reflects that.',
              ],
              [
                'tools inside a turn',
                'when the agent calls grep, edit, run, etc., those are part of the same turn — not separate ones.',
              ],
              [
                'queueing',
                'while a turn is running you can still type. clicking send queues the message and fires automatically when the current turn ends.',
              ],
            ]}
          />
          <H3>Why this matters</H3>
          <P>
            providers bill per token across all messages in the conversation, not per turn. but from
            a UX perspective, "i've sent 14 turns and we still don't have a working build" is a
            useful signal that the session is drifting.
          </P>
        </Article>
      );

    case 'tools':
      return (
        <Article
          heading="Tools"
          intro="tools are actions the agent takes outside of just talking — reading files, running shell commands, editing code, fetching docs."
        >
          <H3>How they show up</H3>
          <P>
            in the transcript, a tool invocation collapses to a single row (e.g. <Code>Bash</Code>,{' '}
            <Code>Read</Code>, <Code>Edit</Code>). click it to expand input/output. consecutive tool
            rows are visually grouped to keep the chat readable.
          </P>
          <H3>Permissions</H3>
          <P>
            kAY.am proxies the CLI's permission system. above the input you see{' '}
            <Code>permissions: X allow / Y deny</Code> — that's the rule set the next turn will run
            under. click it to manage rules in settings.
          </P>
          <H3>Skills</H3>
          <P>
            type <Code>/</Code> in the input to invoke a workspace skill (a pre-defined prompt
            template stored in <Code>.kay/skills/</Code> or <Code>.claude/skills/</Code>). useful
            for repeatable flows — release notes, security review, migration plan.
          </P>
        </Article>
      );

    case 'tokens':
      return (
        <Article
          heading="Tokens & cost"
          intro="every message — yours and the assistant's — is converted into tokens before billing. roughly 1 token ≈ ¾ of an English word."
        >
          <H3>Input vs output</H3>
          <List
            items={[
              [
                'input tokens',
                'everything sent into the model: system prompt, conversation history, tool results, your latest message. grows every turn — that is why later turns cost more even if your message is short.',
              ],
              [
                'cached input tokens',
                'portions of the prompt the provider can re-use from a recent call (Anthropic prompt cache). billed at ~10% of input rate. green numbers in pricing dialog.',
              ],
              [
                'output tokens',
                'what the model writes back: text + tool calls. the most expensive token category (5–15× input rate).',
              ],
            ]}
          />
          <H3>Context window</H3>
          <P>
            each model has a hard ceiling on how many tokens fit in one call (Opus 4.7 1M, Sonnet
            4.6 / Haiku 4.5 200k, gpt-4o 128k). the bar under each agent shows how full the current
            context is. above 75% → the agent starts forgetting; consider summarising or starting a
            new session.
          </P>
          <H3>Cost colors</H3>
          <List
            items={[
              [
                'green models',
                'cheap (haiku, cursor-small). good for grep-heavy / planning steps.',
              ],
              ['amber models', 'mid (sonnet, gpt-4o). default for most coding work.'],
              [
                'red models',
                'expensive (opus). reserve for hard reasoning, refactors, last-resort fixes.',
              ],
            ]}
          />
          <P>
            the picker sorts <Strong>cheapest first</Strong> on purpose — switching down a tier
            often costs nothing in quality on routine tasks.
          </P>
        </Article>
      );

    case 'agents':
      return (
        <Article
          heading="Agents"
          intro="an agent is one provider invocation inside a session. a session can host multiple agents — same provider or different ones."
        >
          <H3>Why multiple agents per session</H3>
          <List
            items={[
              [
                'role separation',
                'spawn a planning agent on Opus, then a coding agent on Sonnet. each keeps its own transcript.',
              ],
              [
                'workflow steps',
                'a workflow defines ordered steps (e.g. plan → implement → done). each step spawns an agent with its own model + system prompt.',
              ],
              [
                'parallel exploration',
                'two agents on the same goal, diff their results, pick the better diff at merge time.',
              ],
            ]}
          />
          <H3>Reading the agent row</H3>
          <P>
            the second line on each agent shows:{' '}
            <Code>model · ↓ input · ↑ output · cost · ⏱ age</Code>. below it, a thin bar = context
            window utilisation. tooltip on the bar gives exact numbers.
          </P>
        </Article>
      );

    case 'tips':
      return (
        <Article heading="Tips" intro="patterns that compound across sessions.">
          <List
            items={[
              [
                'pin one short goal per session',
                'long open-ended sessions drift. when you notice scope creeping, spin a new one and link via context.',
              ],
              [
                'set a soft cap',
                'even a generous one. it forces a pause before a runaway agent burns $20 on a bad assumption.',
              ],
              [
                'use cheap models for navigation',
                'haiku / cursor-small can grep, list, summarise in seconds at 1/15th the price. swap up only when reasoning gets hard.',
              ],
              [
                "queue, don't cancel",
                "if the agent is mid-tool and you have a follow-up, type it — it'll queue. cancelling mid-turn loses the partial work.",
              ],
              [
                'archive freely',
                'archive is reversible. the only irreversible move is delete, and you have to confirm twice.',
              ],
              [
                'restart on cli upgrades',
                'when you update the underlying CLI (claude / cursor-agent / codex), restart kAY.am so it re-detects versions and auth.',
              ],
            ]}
          />
        </Article>
      );

    case 'legenda':
      return (
        <Article heading="Legenda" intro="color meanings used throughout the interface.">
          <H3>Status dots — sessions & agents</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-muted-foreground/50', label: 'pending', desc: 'not yet started' },
              { dot: 'bg-info', label: 'running', desc: 'active turn in progress' },
              { dot: 'bg-success', label: 'completed', desc: 'ended successfully' },
              { dot: 'bg-danger', label: 'failed', desc: 'ended with error' },
              { dot: 'bg-muted-foreground/30', label: 'skipped', desc: 'bypassed by workflow logic' },
            ]}
          />
          <H3>Edit types — transcript</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-primary', label: 'create', desc: 'new file or resource added' },
              { dot: 'bg-muted-foreground/60', label: 'modify', desc: 'existing file changed' },
              { dot: 'bg-danger', label: 'delete', desc: 'file or resource removed' },
            ]}
          />
          <H3>Context window bar — CTX fill level</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-success', label: '< 50%', desc: 'comfortable — plenty of context remaining' },
              { dot: 'bg-info', label: '50–75%', desc: 'moderate — monitor closely' },
              { dot: 'bg-warning', label: '75–90%', desc: 'high — consider summarising soon' },
              { dot: 'bg-danger', label: '≥ 90%', desc: 'critical — start a new session' },
            ]}
          />
          <H3>Verbosity — output density</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-success', label: 'essential', desc: 'bare minimum — one-liners only' },
              { dot: 'bg-success/70', label: 'minimal', desc: 'brief but complete' },
              { dot: 'bg-info', label: 'normal', desc: 'standard prose with rationale' },
              { dot: 'bg-warning', label: 'detailed', desc: 'extra context and reasoning' },
              { dot: 'bg-danger', label: 'verbose', desc: 'full long-form with alternatives' },
            ]}
          />
          <H3>Permission mode — tool access</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-danger', label: 'bypass', desc: 'all tools used freely — no prompts' },
              { dot: 'bg-warning', label: 'edits', desc: 'file edits allowed; bash asks first' },
              { dot: 'bg-blue-500', label: 'default', desc: 'writes and runs ask for approval' },
              { dot: 'bg-slate-400', label: 'plan', desc: 'no tool calls executed — read-only' },
            ]}
          />
          <H3>Auto badge</H3>
          <LegendaGrid
            rows={[
              { dot: 'bg-amber-400', label: 'AUTO', desc: 'autorun mode — next action fires without user confirmation' },
            ]}
          />
        </Article>
      );
  }
}

function Article({
  heading,
  intro,
  children,
}: {
  heading: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 pb-6 text-sm leading-relaxed">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{heading}</h2>
      <p className="text-muted-foreground">{intro}</p>
      {children}
    </article>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-foreground/85">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function List({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(([term, desc]) => (
        <li key={term} className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{term}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{desc}</span>
        </li>
      ))}
    </ul>
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
          <span aria-hidden className={cn('inline-block h-2 w-2 shrink-0 rounded-full', row.dot)} />
          <span className="w-20 shrink-0 text-sm font-medium text-foreground">{row.label}</span>
          <span className="text-sm text-muted-foreground">{row.desc}</span>
        </li>
      ))}
    </ul>
  );
}
