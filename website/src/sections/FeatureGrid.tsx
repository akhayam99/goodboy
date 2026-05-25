import type { ReactNode } from 'react';

type Feature = {
  title: string;
  body: string;
  span: string;
  icon: ReactNode;
  visual?: ReactNode;
};

const Icon = {
  context: (
    <path
      d="M3 5h10M3 9h10M3 13h7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  ),
  routing: (
    <>
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M6 4h4M6 12h4" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  agents: (
    <>
      <circle cx="5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="11" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M2 14c0-1.5 1-3 3-3s3 1.5 3 3M8 14c0-1.5 1-3 3-3s3 1.5 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </>
  ),
  plan: (
    <>
      <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M5.5 6h5M5.5 8.5h5M5.5 11h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  workflow: (
    <>
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4.5 3h7M4.5 13h7M3 4.5v7M13 4.5v7" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  github: (
    <path
      d="M8 2C4.7 2 2 4.7 2 8c0 2.6 1.7 4.9 4.1 5.7.3.1.4-.1.4-.3v-1.2c-1.7.4-2-.8-2-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.6 0 .9.6.9.6.6 1 1.5.7 1.9.6 0-.4.2-.7.4-.9-1.3-.2-2.7-.7-2.7-3 0-.7.2-1.2.6-1.6 0-.2-.3-.8.1-1.6 0 0 .5-.2 1.6.6.5-.1.9-.2 1.4-.2s.9.1 1.4.2c1.1-.7 1.6-.6 1.6-.6.3.8.1 1.4.1 1.6.4.4.6.9.6 1.6 0 2.3-1.4 2.8-2.7 3 .2.2.4.5.4 1.1v1.7c0 .2.1.4.4.3C12.3 12.9 14 10.6 14 8c0-3.3-2.7-6-6-6z"
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
    />
  ),
  budget: (
    <>
      <rect
        x="2"
        y="6"
        width="12"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M2 9h12" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 4l3-2 3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  permission: (
    <>
      <path
        d="M8 2L3 4v4c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V4l-5-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M6 8l1.5 1.5L10 7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  skill: (
    <>
      <path
        d="M8 2v3M8 11v3M2 8h3M11 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  ),
  worktree: (
    <>
      <circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 4.5v7M5.5 13c2.5 0 5-2 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  ),
  notif: (
    <>
      <path
        d="M4 7a4 4 0 1 1 8 0v3l1 2H3l1-2V7z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 13.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  editor: (
    <>
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3.5" cy="4.5" r="0.5" fill="currentColor" />
      <circle cx="5.5" cy="4.5" r="0.5" fill="currentColor" />
    </>
  ),
};

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-soft bg-muted text-primary">
      <svg width="16" height="16" viewBox="0 0 16 16">
        {children}
      </svg>
    </div>
  );
}

const features: Feature[] = [
  {
    title: 'Shared context panel',
    body: 'Five synthetic slots (goal, decisions, files touched, open questions, last output) live outside the chat. Auto-populated, hand-editable. Every agent reads the same notes.',
    span: 'lg:col-span-2 lg:row-span-2',
    icon: <IconWrap>{Icon.context}</IconWrap>,
    visual: <ContextVisual />,
  },
  {
    title: 'Multi-provider routing',
    body: 'Claude. Cursor. Codex. Route by task, by budget, by latency. Switch mid-session without re-explaining.',
    span: 'lg:col-span-2',
    icon: <IconWrap>{Icon.routing}</IconWrap>,
  },
  {
    title: 'Multi-agent sessions',
    body: 'Spawn scouts, planners, implementers, reviewers in parallel. Each has its own thread, model, and effort. Independent work, shared notes.',
    span: '',
    icon: <IconWrap>{Icon.agents}</IconWrap>,
  },
  {
    title: 'Plans as artifacts',
    body: 'Planner output gets captured as a structured plan, not buried in transcripts. Consumed by downstream agents, tracked to completion.',
    span: '',
    icon: <IconWrap>{Icon.plan}</IconWrap>,
  },
  {
    title: 'Workflow presets',
    body: 'Pre-built or custom flows fan out agents at session start: scout → planner → implementer → reviewer. Sequential or parallel.',
    span: 'lg:col-span-2',
    icon: <IconWrap>{Icon.workflow}</IconWrap>,
  },
  {
    title: 'GitHub integration',
    body: 'PR state, CI checks, review decisions, linked issues, line-level diff comments. Refreshed in real time.',
    span: '',
    icon: <IconWrap>{Icon.github}</IconWrap>,
  },
  {
    title: 'Budget control',
    body: 'Per-provider monthly caps. Per-session soft caps. Configurable threshold alerts. Real-time USD next to every turn.',
    span: '',
    icon: <IconWrap>{Icon.budget}</IconWrap>,
  },
  {
    title: 'Permission proxy',
    body: 'Tool-call interception, static rule matching, audit trail. Run agents autonomously without losing the kill switch.',
    span: 'lg:col-span-2',
    icon: <IconWrap>{Icon.permission}</IconWrap>,
  },
  {
    title: 'Skills & slash-commands',
    body: 'Workspace-scoped automation (.kay/skills/). Markdown + scripts. Invoke /skill in chat across any provider.',
    span: '',
    icon: <IconWrap>{Icon.skill}</IconWrap>,
  },
  {
    title: 'Git worktrees',
    body: 'Each session lives on its own branch + worktree. Auto-created, auto-cleaned. Agents never collide on the working tree.',
    span: '',
    icon: <IconWrap>{Icon.worktree}</IconWrap>,
  },
  {
    title: 'Editor integration',
    body: "Open VS Code or Cursor on the right worktree, on the right branch, when it's time to write code. Then hand control back.",
    span: '',
    icon: <IconWrap>{Icon.editor}</IconWrap>,
  },
  {
    title: 'Notifications & nudges',
    body: 'Budget alerts, PR state changes, session events. Toast for transient, feed for full history. No spam.',
    span: '',
    icon: <IconWrap>{Icon.notif}</IconWrap>,
  },
];

function ContextVisual() {
  const slots = [
    { label: 'Goal', value: 'Audit reversions on context slots.', tone: 'oklch(0.78 0.13 200)' },
    { label: 'Decisions', value: '3 entries · last edit 2m ago', tone: 'oklch(0.86 0.13 55)' },
    {
      label: 'Files touched',
      value: '3 paths in packages/db, packages/core',
      tone: 'oklch(0.69 0.11 238)',
    },
    { label: 'Open questions', value: '1 · awaiting answer', tone: 'oklch(0.76 0.13 78)' },
    {
      label: 'Last output',
      value: 'Migration applied · tests green',
      tone: 'oklch(0.69 0.13 148)',
    },
  ];
  return (
    <div className="mt-5 space-y-1.5">
      {slots.map((s) => (
        <div
          key={s.label}
          className="rounded-md border border-border-soft bg-[oklch(0.27_0.008_255)] px-3 py-2 flex items-center gap-3"
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.tone }} />
          <span className="text-[10.5px] uppercase tracking-wider text-[oklch(0.58_0.015_255)] w-20 shrink-0">
            {s.label}
          </span>
          <span className="text-[12px] text-[oklch(0.86_0.008_90)] truncate">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            Features
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl leading-[1.05] tracking-[-0.025em] font-semibold text-foreground">
            Everything an agent needs to work alongside you.
          </h2>
          <p className="mt-5 max-w-prose text-[15px] leading-[1.7] text-muted-foreground">
            Twelve building blocks. They compose. They stay out of your way until you need them.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[230px]">
          {features.map((f) => (
            <article
              key={f.title}
              className={[
                'rounded-xl border border-border-soft bg-subtle p-6 transition-colors hover:border-border',
                f.span,
              ].join(' ')}
            >
              <div className="flex items-start justify-between">{f.icon}</div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.005em] text-foreground">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.65] text-muted-foreground">{f.body}</p>
              {f.visual}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
