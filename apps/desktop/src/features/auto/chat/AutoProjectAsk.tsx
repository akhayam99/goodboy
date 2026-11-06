import { useState } from 'react';
import { Button, FormActions, formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { mountOnBranchOf } from '../../../store/runtime/auto/mount/mountOnBranchOf';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { projectAnswerOf } from './projectAnswerOf';
import { knownMountOf } from './knownMountOf';
import type { ProjectAsk } from './projectAskOf';
import type { ProjectCandidate } from './projectCandidate';
import { useProjectCandidates } from './hooks/useProjectCandidates';
import { ProjectPickList } from './ProjectPickList';
import { ObjectActionVerb } from '../../actions/ObjectActionVerb';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly ask: ProjectAsk;
};

type Answered = Readonly<{
  key: string;
  word: string;
}>;

const JUST_ANSWER = 'Answer without a project';

type ReplyParams = {
  readonly content: string;
  readonly word: string;
};

type RunParams = {
  readonly label: string;
  readonly work: () => Promise<void>;
};

export const AutoProjectAsk = ({ sessionId, rootAgentId, ask }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const ensureProjectMounted = useAppStore((state) => state.ensureProjectMounted);
  const [picked, setPicked] = useState<ReadonlyArray<string>>([]);
  const [isAnotherOpen, setIsAnotherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);

  const { inSession, others, workspaceId } = useProjectCandidates({ sessionId, query });

  if (answered !== null && answered.key === ask.key) {
    return (
      <p role="status" className="text-ui text-muted-foreground">
        {answered.word}
      </p>
    );
  }

  const mountAsk = ask.mount;
  const known = isAnotherOpen
    ? null
    : knownMountOf({ candidates: projects, workspaceId, mount: mountAsk });
  const card = known === null ? null : known.card;

  const all = [...inSession, ...others];
  const picks = all.filter((candidate) => picked.includes(candidate.key));
  const answer = projectAnswerOf({ picks, roleNoun: ask.roleNoun });
  const isBusy = busy !== null;

  const toggle = ({ key }: Pick<ProjectCandidate, 'key'>) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  const reply = async ({ content, word }: ReplyParams): Promise<void> => {
    await sendTurn({ sessionId, agentId: rootAgentId, content });
    setAnswered({ key: ask.key, word });
  };

  const run = async ({ label, work }: RunParams): Promise<void> => {
    if (isBusy) {
      return;
    }
    setBusy(label);
    setError(null);
    try {
      await work();
    } catch (cause) {
      if (!isReportedError(cause)) {
        setError(formatError(cause));
      }
    } finally {
      setBusy(null);
    }
  };

  const use = () =>
    run({
      label: answer.label,
      work: async () => {
        const message = answer.message;
        if (message === null) {
          return;
        }
        for (const pick of picks.filter((candidate) => !candidate.isMounted)) {
          setBusy(`Creating a worktree for ${pick.name} from main`);
          await ensureProjectMounted({
            sessionId,
            projectId: pick.projectId,
            reason: `Auto asked where the ${ask.roleNoun} should work`,
          });
        }
        await reply({
          content: message,
          word: `Answered: ${picks.map((pick) => pick.name).join(', ')}`,
        });
      },
    });

  const mountKnown = () =>
    run({
      label: card?.busyLabel ?? 'Adding',
      work: async () => {
        if (card === null || mountAsk === null || known === null) {
          return;
        }
        await ensureProjectMounted({
          sessionId,
          projectId: known.project.id,
          reason: mountAsk.reason,
          ...(mountAsk.branch === null ? {} : { branch: mountAsk.branch }),
        });
        const landed = mountOnBranchOf({
          mounts: useAppStore.getState().sessionProjectMounts[sessionId] ?? [],
          projectId: known.project.id,
          branch: mountAsk.branch,
        });
        if (landed.kind === 'elsewhere') {
          throw new Error(
            `${known.project.name} is already added on branch ${landed.mount.branch}, not on ${mountAsk.branch ?? ''}.`,
          );
        }
        await reply({ content: card.message, word: card.doneLine });
      },
    });

  return (
    <section
      aria-label="Project for this agent"
      data-dock-ask="project"
      className="flex min-w-0 flex-col gap-2"
    >
      <p className="text-row text-foreground">
        {card === null ? `Where should the ${ask.roleNoun} work?` : card.title}
      </p>
      {card !== null ? (
        <p className="text-ui text-muted-foreground">{card.line}</p>
      ) : (
        <ProjectPickList
          shown={isAnotherOpen ? all : inSession}
          picked={picked}
          isDisabled={isBusy}
          hasInSession={inSession.length > 0}
          isSearchOpen={isAnotherOpen}
          query={query}
          onToggle={toggle}
          onQuery={setQuery}
        />
      )}
      <FormActions
        error={error}
        leading={
          <span className="flex items-center gap-1">
            {isAnotherOpen ? null : (
              <Button variant="quiet" size="sm" onClick={() => setIsAnotherOpen(true)}>
                Add project
              </Button>
            )}
            <Button
              variant="quiet"
              size="sm"
              disabled={isBusy}
              onClick={() =>
                void run({
                  label: JUST_ANSWER,
                  work: () =>
                    reply({
                      content: 'No project, just answer in the chat.',
                      word: 'Answered without a project',
                    }),
                })
              }
            >
              {JUST_ANSWER}
            </Button>
            <ObjectActionVerb
              actionId="projectAsk.discard"
              target={{
                kind: 'projectAsk',
                facts: {
                  isBusy,
                  onDiscard: () =>
                    void run({
                      label: 'Discard request',
                      work: () =>
                        reply({
                          content: 'Discard that request. Start nothing.',
                          word: 'Discarded',
                        }),
                    }),
                },
              }}
            />
          </span>
        }
      >
        <Button
          size="sm"
          disabled={card === null ? answer.message === null || isBusy : isBusy}
          isBusy={isBusy}
          busyLabel={busy ?? (card === null ? answer.label : card.busyLabel)}
          onClick={() => void (card === null ? use() : mountKnown())}
        >
          {card === null ? answer.label : card.label}
        </Button>
      </FormActions>
    </section>
  );
};
