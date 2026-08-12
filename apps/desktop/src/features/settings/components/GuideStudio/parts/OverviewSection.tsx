import { BookOpen, GitBranch, LayoutDashboard, MessageSquare } from 'lucide-react';
import { Eyebrow, SectionHeader } from '@goodboy/ui';
import { SESSION_FEATURES } from '../../../../../shared/lib/features';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import { Callout } from './Callout';
import { ConceptCard } from './ConceptCard';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Section =
  'overview' | 'board' | 'session' | 'turn' | 'tools' | 'tokens' | 'agents' | 'tips' | 'legenda';

type Props = {
  readonly onJump: (s: Section) => void;
};

export const OverviewSection = ({ onJump }: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<BookOpen size={14} aria-hidden className="text-primary" />}
      label="What is Goodboy?"
      hint={
        SESSION_FEATURES.budget
          ? 'A builder cockpit for running coding agents in parallel. The home screen is a cross-session stage board: every piece of work in a workspace, grouped by what it needs from you. Chat, diff, terminal, IDE, and the studios are destinations you navigate to from there, with budget caps and audit logs along the way.'
          : 'A builder cockpit for running coding agents in parallel. The home screen is a cross-session stage board: every piece of work in a workspace, grouped by what it needs from you. Chat, diff, terminal, IDE, and the studios are destinations you navigate to from there, with audit logs along the way.'
      }
    />

    <Callout tone="info" icon={<CONCEPT_ICONS.providers size={13} />}>
      Goodboy does <strong className="text-foreground">not</strong> talk to providers directly. It
      spawns each provider's own CLI as a subprocess and streams its events. Your login, usage, and
      quotas stay inside that CLI. Goodboy adds the workspace, board, and orchestration layer on
      top, provider-neutral by design.
    </Callout>

    <div>
      <Eyebrow label="Mental model" />
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
);
