/* eslint-disable react-refresh/only-export-components */
/**
 * Hero app mockup. Faithful pseudo-data reproduction of the Goodboy desktop
 * UI. Mirrors layout, palette, density, and iconography from
 * apps/desktop/src/. Colors track the app's @theme tokens:
 *   bg          oklch(0.25 0.006 255)
 *   subtle      oklch(0.29 0.008 255)
 *   muted       oklch(0.33 0.010 255)
 *   elevated    oklch(0.37 0.011 255)
 *   border      oklch(0.40 0.012 255)
 *   border-soft oklch(0.32 0.010 255)
 *   primary     oklch(0.74 0.11 200)  (teal/cyan accent)
 *   foreground  oklch(0.91 0.006 90)
 *   muted-fg    oklch(0.68 0.015 255)
 */

import {
  IconArchive,
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconBranch,
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconClock,
  IconDollar,
  IconEdit,
  IconFolder,
  IconHelp,
  IconList,
  IconLock,
  IconPanelLeft,
  IconPlus,
  IconPullRequest,
  IconSearch,
  IconSend,
  IconSettings,
  IconSparkles,
  IconSun,
  IconTarget,
  IconTerminal,
  IconWand,
  IconWorkflow,
} from '../components/Icons';
import { DogMascot } from '../components/DogMascot';

const C = {
  bg: 'bg-[oklch(0.25_0.006_255)]',
  subtle: 'bg-[oklch(0.29_0.008_255)]',
  muted40: 'bg-[oklch(0.33_0.010_255_/_0.4)]',
  muted60: 'bg-[oklch(0.33_0.010_255_/_0.6)]',
  elevated: 'bg-[oklch(0.37_0.011_255)]',
  border: 'border-[oklch(0.40_0.012_255)]',
  borderSoft: 'border-[oklch(0.32_0.010_255)]',
  fg: 'text-[oklch(0.91_0.006_90)]',
  mutedFg: 'text-[oklch(0.68_0.015_255)]',
  dimFg: 'text-[oklch(0.55_0.015_255)]',
  faintFg: 'text-[oklch(0.50_0.015_255)]',
  primary: 'text-[oklch(0.78_0.13_200)]',
  primaryRing: 'ring-[oklch(0.74_0.11_200_/_0.45)]',
  primaryBg: 'bg-[oklch(0.74_0.11_200_/_0.10)]',
};

function WindowChrome() {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-[oklch(0.27_0.008_255)] border-b border-[oklch(0.32_0.010_255)]">
      <span className="h-3 w-3 rounded-full bg-[oklch(0.63_0.17_22)]" />
      <span className="h-3 w-3 rounded-full bg-[oklch(0.76_0.13_78)]" />
      <span className="h-3 w-3 rounded-full bg-[oklch(0.69_0.13_148)]" />
    </div>
  );
}

// chip colors mirror AGENT_KIND_PALETTE in apps/desktop/src/features/session/agent-kind.ts
const KIND_BG = {
  agent: 'bg-[oklch(0.84_0.16_82)]', // amber-400
  plan: 'bg-[oklch(0.74_0.16_295)]', // violet-400
  imple: 'bg-[oklch(0.77_0.15_162)]', // emerald-400
  review: 'bg-[oklch(0.79_0.13_213)]', // cyan-400
  scout: 'bg-[oklch(0.76_0.13_232)]', // sky-400
  debug: 'bg-[oklch(0.84_0.16_82)]', // amber-400
} as const;

function KindChip({ kind }: { kind: keyof typeof KIND_BG }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide leading-none text-zinc-950',
        KIND_BG[kind],
      ].join(' ')}
    >
      {kind}
    </span>
  );
}

/**
 * Workspace selector row at the very top of the sidebar.
 * Mirrors WorkspaceSelect: outline pills, current one filled.
 */
function WorkspaceSelectorRow() {
  return (
    <div className={`flex items-center gap-1 px-2.5 pt-2.5 pb-1.5 border-b ${C.borderSoft}`}>
      <button className="flex items-center gap-1 rounded border border-[oklch(0.40_0.012_255_/_0.6)] bg-transparent px-1.5 py-0.5 text-[10px] text-[oklch(0.72_0.012_255)]">
        app-web
        <IconSettings size={9} className="opacity-50" />
      </button>
      <button
        className={`flex items-center gap-1 rounded border ${C.border} ${C.elevated} px-1.5 py-0.5 text-[10px] ${C.fg}`}
      >
        goodboy
        <IconSettings size={9} className="opacity-60" />
      </button>
      <button className={`rounded border border-[oklch(0.40_0.012_255_/_0.6)] p-1 ${C.mutedFg}`}>
        <IconPlus size={9} />
      </button>
      <span className={`ml-auto text-[9px] font-mono ${C.dimFg}`}>2/3</span>
    </div>
  );
}

/**
 * Sessions rail: w-28 narrow column with vertical-stacked session cards.
 * Each card is centered, icon top, 2-line title, cost bottom.
 * Matches SessionActivityBar at apps/desktop/src/features/workspace/components/SessionActivityBar.
 */
function SessionsRail() {
  return (
    <div className={`w-[112px] shrink-0 flex flex-col border-r ${C.borderSoft}`}>
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <span className={`text-[9px] uppercase tracking-[0.10em] font-semibold ${C.dimFg}`}>
          Sessions
        </span>
        <button className={`${C.dimFg}`}>
          <IconList size={9} />
        </button>
      </div>
      <button
        className={`mx-1.5 mb-1.5 flex items-center justify-center gap-1 rounded border ${C.borderSoft} ${C.muted40} py-1 text-[9.5px] ${C.mutedFg}`}
      >
        <IconPlus size={9} /> New session
      </button>

      <div className="flex-1 overflow-hidden flex flex-col px-1.5 gap-1">
        <GroupRow label="No PR" count={1} />
        <RailItem
          icon={<IconHelp size={10} className="text-[oklch(0.86_0.13_78)]" />}
          title="openquestions as a gamification"
          cost="$12.36"
        />

        <GroupRow label="Draft" count={1} />
        <RailItem
          icon={<IconWorkflow size={10} className={C.primary} />}
          prChip="draft"
          title="Multi-workflow"
          cost="$4.36"
          active
        />

        <GroupRow label="In review" count={1} />
        <RailItem
          icon={<IconClock size={10} className="text-[oklch(0.86_0.13_78)]" />}
          prChip="review"
          title="euristic agent title"
          cost="$10.36"
        />
      </div>

      <div className="p-1.5">
        <button
          className={`flex w-full items-center justify-center gap-1 rounded py-1 text-[9.5px] ${C.mutedFg}`}
        >
          <IconArchive size={10} /> Archived
        </button>
      </div>
    </div>
  );
}

function GroupRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-1.5 first:mt-0 flex items-center gap-1 px-0.5">
      <span className={`text-[8.5px] font-semibold uppercase tracking-[0.10em] ${C.dimFg}`}>
        {label}
      </span>
      <span className={`text-[8.5px] font-mono ${C.faintFg}`}>{count}</span>
      <span className={`ml-0.5 h-px flex-1 ${C.muted60}`} />
    </div>
  );
}

function RailItem({
  icon,
  title,
  cost,
  active,
  prChip,
}: {
  icon: React.ReactNode;
  title: string;
  cost: string;
  active?: boolean;
  prChip?: 'draft' | 'review';
}) {
  const prColor =
    prChip === 'draft'
      ? 'text-[oklch(0.68_0.015_255)]'
      : prChip === 'review'
        ? 'text-[oklch(0.86_0.13_78)]'
        : '';
  return (
    <button
      className={[
        'flex w-full flex-col items-center gap-1 rounded border px-1 py-2 text-center transition-colors',
        active
          ? `${C.elevated} ${C.fg} border-[oklch(0.40_0.012_255)] shadow-sm`
          : `${C.muted40} text-[oklch(0.78_0.01_255_/_0.85)] border-transparent`,
      ].join(' ')}
    >
      <span className="flex items-center gap-1">
        {icon}
        {prChip ? (
          <span className={`text-[8px] font-semibold uppercase ${prColor}`}>
            <IconPullRequest size={9} />
          </span>
        ) : null}
      </span>
      <span
        className={`line-clamp-2 w-full text-[9.5px] leading-tight ${active ? C.fg : C.mutedFg}`}
      >
        {title}
      </span>
      <span className={`text-[8.5px] font-mono ${C.faintFg}`}>{cost}</span>
    </button>
  );
}

/**
 * Session detail panel: title bar at top, agents/workflow scroll body,
 * meta footer at bottom. Mirrors SessionDetailPanel + AgentsSection.
 */
function SessionDetail() {
  return (
    <div className="flex-1 min-w-[260px] flex flex-col overflow-hidden">
      {/* detail header: status + title + icons */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span className="h-3.5 w-3.5 rounded-full bg-[oklch(0.69_0.13_148_/_0.18)] inline-flex items-center justify-center ring-1 ring-[oklch(0.69_0.13_148_/_0.4)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.82_0.13_148)]" />
        </span>
        <span className={`flex-1 line-clamp-1 text-[11.5px] font-semibold ${C.fg}`}>
          Multi-workflow
        </span>
        <IconFolder size={11} className={C.dimFg} />
        <IconTerminal size={11} className={C.dimFg} />
        <IconSettings size={11} className={C.dimFg} />
      </div>

      <div className="px-3 flex items-center justify-between pt-2 pb-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.10em] font-semibold ${C.dimFg}`}
        >
          <IconWorkflow size={9} className={C.primary} />
          Workflow
        </span>
        <span className={`inline-flex items-center gap-1 text-[9px] ${C.faintFg}`}>
          custom
          <IconLock size={9} />
        </span>
      </div>

      <div className="px-2 space-y-px">
        <Step n={1} kind="agent" title="Analyze Branch State" model="haiku-4" />
        <Step n={2} kind="plan" title="Plan Completion" model="opus-4" />
        <Step n={3} kind="imple" title="Implement Restructuring" model="sonnet-4" />
        <Step n={4} kind="review" title="Review, Cleanup, Create PR" model="sonnet-4" active />
      </div>

      <div
        className={`px-3 pt-3 pb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.10em] font-semibold ${C.dimFg}`}
      >
        <IconSparkles size={9} className={C.primary} />
        Agents
      </div>
      <div className="px-2 space-y-px">
        <AgentRowMock n={1} kind="imple" name="agent 5" age="12m" />
        <button
          className={`w-full flex items-center justify-center gap-1 mt-1 rounded py-1 text-[9.5px] ${C.mutedFg} border border-dashed ${C.borderSoft}`}
        >
          <IconPlus size={9} /> Spawn agent
        </button>
      </div>

      <div className="flex-1" />

      {/* meta footer */}
      <div className={`border-t ${C.borderSoft} px-2.5 py-2 flex items-center gap-1.5`}>
        <IconBranch size={10} className={C.mutedFg} />
        <span className={`text-[9.5px] font-mono truncate ${C.mutedFg} flex-1`}>
          kay/multi-workflow-for-session
        </span>
        <span className="inline-flex items-center rounded bg-[oklch(0.69_0.13_148_/_0.15)] text-[oklch(0.82_0.13_148)] px-1.5 py-px font-mono text-[9px] ring-1 ring-[oklch(0.69_0.13_148_/_0.3)]">
          $4.36
        </span>
      </div>
    </div>
  );
}

function Step({
  n,
  kind,
  title,
  model,
  active,
}: {
  n: number;
  kind: keyof typeof KIND_BG;
  title: string;
  model: string;
  active?: boolean;
}) {
  return (
    <div
      className={['rounded px-1.5 py-1', active ? `${C.muted40} ring-1 ${C.primaryRing}` : ''].join(
        ' ',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-3 shrink-0 text-center text-[9px] font-mono ${C.faintFg}`}>{n}.</span>
        <span className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.69_0.13_148_/_0.18)] ring-1 ring-[oklch(0.69_0.13_148_/_0.4)]">
          <span className="h-1 w-1 rounded-full bg-[oklch(0.82_0.13_148)]" />
        </span>
        <KindChip kind={kind} />
        <span className={`text-[10.5px] ${C.fg} truncate flex-1`}>{title}</span>
        <span
          className={`shrink-0 rounded px-1 py-px text-[8.5px] font-mono ${C.mutedFg} ${C.muted40} ring-1 ${C.borderSoft}`}
        >
          {model}
        </span>
      </div>
      {active ? (
        <div className={`mt-1 ml-7 flex items-center gap-2 text-[9px] font-mono ${C.dimFg}`}>
          <span className="inline-flex items-center gap-0.5">
            <IconArrowDown size={8} />
            13
          </span>
          <span className="inline-flex items-center gap-0.5">
            <IconArrowUp size={8} />
            7.2k
          </span>
          <span>1t</span>
          <span className="text-[oklch(0.82_0.13_148)]">$0.220</span>
          <span className="inline-flex items-center gap-0.5">
            <IconClock size={8} />
            2m
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <span className={C.primary}>CTX</span>
            <span className="inline-block h-1 w-10 rounded-full bg-[oklch(0.33_0.010_255)] overflow-hidden">
              <span className="block h-full w-[4%] bg-[oklch(0.74_0.11_200)]" />
            </span>
            <span>4%</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function AgentRowMock({
  n,
  kind,
  name,
  age,
}: {
  n: number;
  kind: keyof typeof KIND_BG;
  name: string;
  age: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1 rounded">
      <span className={`w-3 shrink-0 text-center text-[9px] font-mono ${C.faintFg}`}>{n}.</span>
      <KindChip kind={kind} />
      <span className={`text-[10.5px] ${C.fg} flex-1 truncate`}>{name}</span>
      <span className={`text-[9px] font-mono ${C.dimFg}`}>{age}</span>
    </div>
  );
}

/**
 * Sidebar shell: workspace selector + sessions rail + session detail,
 * with footer logo/icons row. Width tuned so 3 rail items + ~260px detail fit.
 */
function Sidebar() {
  return (
    <aside
      className={`w-[400px] shrink-0 flex flex-col ${C.bg} border-r ${C.borderSoft}`}
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      <WorkspaceSelectorRow />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SessionsRail />
        <SessionDetail />
      </div>
      {/* sidebar footer */}
      <div className={`flex items-center gap-1.5 px-2.5 py-2 border-t ${C.borderSoft}`}>
        <DogMascot size={14} className={`${C.fg} shrink-0`} />
        <span className={`text-[10.5px] font-semibold ${C.fg}`}>Goodboy</span>
        <span className="ml-auto flex items-center gap-1">
          <IconPanelLeft size={11} className={C.mutedFg} />
          <IconDollar size={11} className={C.mutedFg} />
          <IconSun size={11} className={C.mutedFg} />
          <span className="relative inline-flex">
            <IconHelp size={11} className={C.mutedFg} />
            <span className="absolute -top-1.5 -right-2 bg-[oklch(0.76_0.13_78)] text-zinc-950 text-[7px] font-mono px-0.5 rounded leading-none py-px">
              99+
            </span>
          </span>
          <IconSettings size={11} className={C.mutedFg} />
        </span>
      </div>
    </aside>
  );
}

function Transcript() {
  return (
    <div
      className={`flex-1 flex flex-col min-w-0 ${C.bg}`}
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Breadcrumb */}
      <div className={`flex items-center gap-1.5 border-b ${C.borderSoft} px-4 py-2.5 text-[11px]`}>
        <span className={C.mutedFg}>goodboy</span>
        <IconChevronRight size={9} className={C.faintFg} />
        <span className={C.mutedFg}>Multi-workflow</span>
        <IconChevronRight size={9} className={C.faintFg} />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.82_0.13_148)]" />
          <span className={C.fg}>Review, Cleanup, Create PR</span>
        </span>
        <KindChip kind="review" />
      </div>

      {/* Markdown content */}
      <div className={`flex-1 overflow-hidden px-5 py-4 text-[12.5px] leading-[1.65] ${C.fg}`}>
        <p className={`font-mono text-[11px] ${C.dimFg}`}>
          <code className="text-[oklch(0.88_0.12_200)]">BEGIN</code> /{' '}
          <code className="text-[oklch(0.88_0.12_200)]">COMMIT</code> or equivalent.
        </p>

        <p className="mt-3">
          <span className={`font-semibold ${C.fg}`}>3.</span>{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">insertSession</code> silently
          drops <code className="font-mono text-[oklch(0.88_0.12_200)]">workflowIds</code>{' '}
          <span className={`font-mono text-[10.5px] ${C.dimFg}`}>(session.ts:175.194)</span>
        </p>
        <p className={`mt-1 text-[12px] ${C.mutedFg}`}>
          <code className="font-mono text-[oklch(0.88_0.12_200)]">insertSession</code> no longer
          writes <code className="font-mono text-[oklch(0.88_0.12_200)]">workflow_id</code> to{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">sessions</code> (correct), but
          also never writes to{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">session_workflows</code>. a
          Session with{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">workflowIds: ['wf1']</code> passed
          to <code className="font-mono text-[oklch(0.88_0.12_200)]">insertSession</code> loses
          those associations silently.
        </p>

        <h4 className={`mt-3 text-[12px] font-semibold ${C.fg}`}>design issues</h4>

        <p className="mt-2">
          <span className={`font-semibold ${C.fg}`}>4.</span>{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">updateSessionWorkflow</code>{' '}
          legacy compat is inconsistent
        </p>
        <ul className={`mt-1 space-y-1 text-[12px] ${C.mutedFg}`}>
          <li className="flex gap-2">
            <span className={`${C.faintFg} shrink-0`}>·</span>
            <span>
              writes back to{' '}
              <code className="font-mono text-[oklch(0.88_0.12_200)]">sessions.workflow_id</code>{' '}
              (scalar). correct for first attachment, but when a second workflow is attached via{' '}
              <code className="font-mono text-[oklch(0.88_0.12_200)]">attachWorkflowToSession</code>
              , the scalar column goes stale.
            </span>
          </li>
          <li className="flex gap-2">
            <span className={`${C.faintFg} shrink-0`}>·</span>
            <span>
              signature changed from{' '}
              <code className="font-mono text-[oklch(0.88_0.12_200)]">WorkflowId | null</code> to{' '}
              <code className="font-mono text-[oklch(0.88_0.12_200)]">WorkflowId</code>{' '}
              (non-nullable). any caller passing null to detach would break at compile time.
            </span>
          </li>
        </ul>

        <p className="mt-3">
          <span className={`font-semibold ${C.fg}`}>5.</span>{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">SessionRow</code> interface
          removed <code className="font-mono text-[oklch(0.88_0.12_200)]">workflow_id</code> but{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">SELECT *</code> still fetches it
        </p>

        <h4 className={`mt-3 text-[12px] font-semibold ${C.fg}`}>minor</h4>
        <p className={`mt-2 ${C.mutedFg}`}>
          <span className={`font-semibold ${C.fg}`}>6.</span> duplicate row to domain mapping.{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">loadWorkflowsForSession</code> and{' '}
          <code className="font-mono text-[oklch(0.88_0.12_200)]">listSessionsForWorkspace</code>{' '}
          both independently build the same 5 lines.
        </p>

        <div className={`mt-4 text-[10px] font-mono ${C.faintFg}`}>
          13 in / 7.2k out · 373k cached
        </div>
      </div>

      {/* Composer */}
      <div className={`border-t ${C.borderSoft} px-4 pt-3 pb-3`}>
        <div className={`rounded-lg border ${C.borderSoft} ${C.subtle} px-3 py-2.5`}>
          <div className={`text-[12px] ${C.dimFg}`}>
            Message Claude. <span className="font-mono">$ scripts</span> ·{' '}
            <span className="font-mono">~ workflows</span> ·{' '}
            <span className="font-mono">@ agents</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10.5px]">
            <button className="inline-flex items-center gap-1 rounded bg-[oklch(0.63_0.17_22_/_0.15)] text-[oklch(0.82_0.13_22)] ring-1 ring-[oklch(0.63_0.17_22_/_0.3)] px-2 py-0.5">
              <span className="h-1 w-1 rounded-full bg-current" /> Bypass
              <IconChevronDown size={9} />
            </button>
            <div className={`ml-auto flex items-center gap-2 ${C.mutedFg}`}>
              <span className="font-mono text-[oklch(0.86_0.13_55)]">Claude</span>
              <span className={C.faintFg}>·</span>
              <span className="font-mono">Opus 4.7</span>
              <span className={C.faintFg}>·</span>
              <span className="text-[oklch(0.86_0.13_78)]">High</span>
              <span className={C.faintFg}>·</span>
              <span>Brief</span>
              <button className={`rounded ${C.elevated} p-1 ${C.fg} ring-1 ${C.borderSoft}`}>
                <IconSend size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextPanel() {
  return (
    <aside
      className={`w-[300px] shrink-0 flex flex-col ${C.bg} border-l ${C.borderSoft} text-[11px]`}
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      <div className="px-3 pt-3 pb-2 flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded ${C.subtle} px-2 py-1 text-[9.5px] uppercase tracking-[0.08em] ${C.fg} font-semibold ring-1 ${C.borderSoft}`}
        >
          <IconBook size={9} />
          Context
        </span>
        <button className={`rounded p-1 ${C.dimFg} inline-flex items-center gap-0.5`}>
          <IconClipboard size={10} />
          <span className="text-[8.5px] font-mono">1</span>
        </button>
        <button className={`rounded p-1 ${C.dimFg} inline-flex items-center gap-0.5`}>
          <IconEdit size={10} />
          <span className="text-[8.5px] font-mono">29</span>
        </button>
        <button className={`rounded p-1 ${C.dimFg}`}>
          <IconPullRequest size={10} />
        </button>
        <span
          className={`ml-auto rounded-full ${C.muted40} px-1.5 py-0.5 text-[9px] ${C.mutedFg} font-mono`}
        >
          Σ $0.2472
        </span>
        <button className={`rounded p-1 ${C.dimFg}`}>
          <IconSearch size={10} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-2.5 py-2 space-y-2">
        <Slot
          icon={<IconTarget size={11} className="text-[oklch(0.85_0.12_200)]" />}
          iconBg="bg-[oklch(0.74_0.11_200_/_0.10)] ring-[oklch(0.74_0.11_200_/_0.25)]"
          label="Goal"
          sub="What this session is set out to achieve"
        >
          <p className={`text-[10.5px] ${C.fg} leading-snug`}>
            ristrutturazione 1:n session/workflow su{' '}
            <code className="font-mono text-[oklch(0.88_0.12_200)]">
              kay/multi-workflow-for-session
            </code>
            . type:{' '}
            <code className="font-mono text-[oklch(0.88_0.12_200)]">Session.workflowId</code>{' '}
            diventa <code className="font-mono text-[oklch(0.88_0.12_200)]">workflowIds[]</code>.
            DB: <code className="font-mono text-[oklch(0.88_0.12_200)]">session_workflows</code>{' '}
            (session_id, workflow_id, ordinal). queries:{' '}
            <code className="font-mono text-[oklch(0.88_0.12_200)]">listWorkflowsForSession</code>,{' '}
            <code className="font-mono text-[oklch(0.88_0.12_200)]">attachWorkflowToSession</code>.
            store: <code className="font-mono text-[oklch(0.88_0.12_200)]">sessionWorkflows</code>.
            UI: <code className="font-mono text-[oklch(0.88_0.12_200)]">SessionDetailPanel</code>{' '}
            multi-workflow.
          </p>
        </Slot>

        <Slot
          icon={<IconSparkles size={11} className="text-[oklch(0.82_0.13_148)]" />}
          iconBg="bg-[oklch(0.69_0.13_148_/_0.10)] ring-[oklch(0.69_0.13_148_/_0.25)]"
          label="Decisions"
          sub="Choices already locked in for this session"
          rightMeta="7 items"
          collapsed
        >
          <p className={`text-[10.5px] truncate ${C.mutedFg}`}>
            branch:{' '}
            <code className="font-mono text-[oklch(0.88_0.12_200)]">
              kay/multi-workflow-for-session
            </code>{' '}
            (confermato utente)
          </p>
        </Slot>

        <Slot
          icon={<IconWand size={11} className="text-[oklch(0.82_0.11_238)]" />}
          iconBg="bg-[oklch(0.69_0.11_238_/_0.10)] ring-[oklch(0.69_0.11_238_/_0.25)]"
          label="Last output summary"
          sub="Summary of the assistant's most recent reply"
          collapsed
        >
          <p className={`text-[10.5px] truncate ${C.mutedFg}`}>phase 1 latency analysis:</p>
        </Slot>
      </div>

      <div className={`bg-[oklch(0.27_0.008_255_/_0.6)] border-t ${C.borderSoft} px-3 py-3`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-[oklch(0.76_0.13_78_/_0.12)] ring-1 ring-[oklch(0.76_0.13_78_/_0.3)]">
            <IconHelp size={9} className="text-[oklch(0.86_0.13_78)]" />
          </span>
          <span className={`text-[9.5px] uppercase tracking-[0.08em] font-semibold ${C.fg}`}>
            Open questions
          </span>
        </div>
        <p className={`text-[9.5px] leading-tight ${C.faintFg} pl-6`}>
          Things the agent still needs clarified
        </p>
        <p className="mt-1.5 text-[10.5px] text-[oklch(0.86_0.13_78)] leading-snug pl-6">
          fix 5 latent bugs now in phase 1 patch commit, or review{' '}
          <code className="font-mono">m038/queries</code> schema first?
        </p>
      </div>
    </aside>
  );
}

function Slot({
  icon,
  iconBg,
  label,
  sub,
  rightMeta,
  collapsed,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sub: string;
  rightMeta?: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md ${C.subtle} ring-1 ${C.borderSoft} p-2`}>
      <div className="flex items-center gap-1.5">
        <span className={`flex h-4 w-4 items-center justify-center rounded ring-1 ${iconBg}`}>
          {icon}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`text-[9px] uppercase tracking-[0.08em] font-semibold ${C.fg} flex items-baseline gap-1`}
          >
            {label}
            {rightMeta ? (
              <span className={`text-[8.5px] font-normal normal-case tracking-normal ${C.dimFg}`}>
                · {rightMeta}
              </span>
            ) : null}
          </span>
          <span className={`text-[9px] leading-tight ${C.faintFg} truncate`}>{sub}</span>
        </div>
        {collapsed ? (
          <IconChevronRight size={10} className={C.faintFg} />
        ) : (
          <IconChevronDown size={10} className={C.faintFg} />
        )}
      </div>
      <div className="mt-1.5 pl-1">{children}</div>
    </div>
  );
}

export function AppMockup() {
  return (
    <div className="card-glow overflow-hidden">
      <WindowChrome />
      <div className={`flex h-[600px] ${C.bg} ${C.fg}`}>
        <Sidebar />
        <Transcript />
        <ContextPanel />
      </div>
    </div>
  );
}
