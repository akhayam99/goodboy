import { Section } from '../components/Section';

export function GithubDeepDive() {
  return (
    <Section
      id="github"
      eyebrow="GitHub"
      reverse
      title={<>PRs live where you work.</>}
      body={
        <>
          <p>
            Open the GitHub panel next to your session. PR state, CI checks, reviews, linked issues.
            Refreshed by client-side polling every five minutes, and immediately when an agent
            creates a PR.
          </p>
          <p>
            Diff comments are line-anchored. Spawn a resolver agent on one with a click. It
            addresses the comment in the worktree, commits locally, and posts back. Approvals show
            up in the session feed so you never miss a green light.
          </p>
          <p className="text-[oklch(0.78_0.01_255)] text-[14px]">
            No webhooks to configure. No browser tab to alt-tab. The PR comes to you.
          </p>
        </>
      }
    >
      <GithubMockup />
    </Section>
  );
}

function GithubMockup() {
  return (
    <div className="rounded-xl border border-border-soft bg-subtle p-5 shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-border-soft">
        <div className="flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 16 16" className="text-[oklch(0.86_0.008_90)]">
            <path
              d="M8 2C4.7 2 2 4.7 2 8c0 2.6 1.7 4.9 4.1 5.7.3.1.4-.1.4-.3v-1.2c-1.7.4-2-.8-2-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.6 0 .9.6.9.6.6 1 1.5.7 1.9.6 0-.4.2-.7.4-.9-1.3-.2-2.7-.7-2.7-3 0-.7.2-1.2.6-1.6 0-.2-.3-.8.1-1.6 0 0 .5-.2 1.6.6.5-.1.9-.2 1.4-.2s.9.1 1.4.2c1.1-.7 1.6-.6 1.6-.6.3.8.1 1.4.1 1.6.4.4.6.9.6 1.6 0 2.3-1.4 2.8-2.7 3 .2.2.4.5.4 1.1v1.7c0 .2.1.4.4.3C12.3 12.9 14 10.6 14 8c0-3.3-2.7-6-6-6z"
              fill="currentColor"
            />
          </svg>
          <div>
            <div className="text-[13.5px] font-medium text-[oklch(0.92_0.006_90)]">
              akhayam99/goodboy
            </div>
            <div className="text-[10.5px] text-[oklch(0.68_0.015_255)] font-mono">
              3 open PRs · last sync 12s ago
            </div>
          </div>
        </div>
        <button className="text-[10.5px] rounded border border-[oklch(0.40_0.012_255)] px-2 py-0.5 text-[oklch(0.78_0.01_255)] hover:bg-[oklch(0.30_0.010_255)]">
          refresh
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <PR
          num={617}
          title="feat(core): context_slot_history with rollback"
          branch="ak/context-slot-history"
          state="open"
          checksPass={5}
          checksFail={0}
          reviews={['claude-reviewer ✓', 'human pending']}
        />
        <PR
          num={616}
          title="fix(desktop): annotate sweep opts param"
          branch="ak/typecheck-fix"
          state="merged"
          checksPass={6}
          checksFail={0}
          reviews={['merged via squash']}
        />
        <PR
          num={615}
          title="feat(desktop): client-side pr polling"
          branch="ak/pr-polling"
          state="draft"
          checksPass={3}
          checksFail={1}
          reviews={['ci red']}
        />
      </div>
      <div className="mt-4 pt-3 border-t border-border-soft">
        <div className="text-[10.5px] uppercase tracking-wider text-[oklch(0.58_0.015_255)] pb-2">
          Latest diff comment · PR #617
        </div>
        <div className="rounded-lg border border-border-soft bg-[oklch(0.27_0.008_255)] p-3">
          <div className="flex items-center gap-2 text-[10.5px] text-[oklch(0.68_0.015_255)]">
            <span className="inline-flex items-center gap-1 rounded chip-anthropic px-1.5 py-0.5">
              claude-reviewer
            </span>
            <span>on</span>
            <code className="font-mono text-[oklch(0.88_0.12_200)]">
              packages/db/migrations/038…sql:14
            </code>
          </div>
          <div className="mt-2 text-[12px] text-[oklch(0.86_0.008_90)] leading-relaxed">
            <code className="font-mono text-[10.5px] text-[oklch(0.86_0.13_78)] block bg-[oklch(0.76_0.13_78_/_0.08)] px-2 py-1 rounded mb-2">
              CREATE INDEX idx_history_slot_id ON context_slot_history(slot_id);
            </code>
            Add a composite index on <code className="font-mono">(slot_id, snapshot_at DESC)</code>{' '}
            if reverts need to scan history quickly.
          </div>
        </div>
      </div>
    </div>
  );
}

function PR({
  num,
  title,
  branch,
  state,
  checksPass,
  checksFail,
  reviews,
}: {
  num: number;
  title: string;
  branch: string;
  state: 'open' | 'merged' | 'draft';
  checksPass: number;
  checksFail: number;
  reviews: string[];
}) {
  const stateChip =
    state === 'merged' ? 'chip-merged' : state === 'draft' ? 'chip-warning' : 'chip-success';
  return (
    <div className="rounded-lg border border-border-soft bg-[oklch(0.27_0.008_255)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-[oklch(0.58_0.015_255)]">#{num}</span>
          <span className="text-[12.5px] text-[oklch(0.92_0.006_90)] truncate">{title}</span>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded ${stateChip} px-1.5 py-0.5 text-[10px] uppercase tracking-wider`}
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {state}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-[oklch(0.68_0.015_255)] font-mono">
        <span className="truncate">{branch}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-[oklch(0.69_0.13_148)]" /> {checksPass} pass
        </span>
        {checksFail > 0 && (
          <span className="inline-flex items-center gap-1 text-[oklch(0.86_0.13_22)]">
            <span className="h-1 w-1 rounded-full bg-[oklch(0.63_0.17_22)]" /> {checksFail} fail
          </span>
        )}
        <span>·</span>
        <span className="truncate">{reviews.join(' · ')}</span>
      </div>
    </div>
  );
}
