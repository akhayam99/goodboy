import { FolderGit2, GitBranch, MessagesSquare } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { SESSION_FEATURES } from '../../../../../shared/lib/features';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { Block } from './Block';
import { DefinitionList } from './DefinitionList';
import { Tile } from './Tile';

type Props = Record<never, never>;

export const SessionsSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<GitBranch size={14} aria-hidden className="text-success" />}
      label="Sessions"
      hint="One focused unit of work. Materializes a worktree for each project, with a branch, transcripts, and a goal. It is a card on the board until you open it."
    />

    <Block title="What gets created">
      <DefinitionList
        rows={[
          {
            term: 'worktree',
            desc: 'A separate working directory materialized per project in the session.',
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
                  desc: 'Soft cap in USD. Warning at 80%, error at 100%. Turns you send keep running, autorun workflows stop.',
                  icon: <CONCEPT_ICONS.budget size={11} aria-hidden />,
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
);
