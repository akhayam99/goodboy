import { useMemo, useState } from 'react';
import { Button, Checkbox, FormActions, Input, Notice, formatError } from '@goodboy/ui';
import type { AgentId, ProjectId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { projectById } from '../../../store/slices/projects/projectIndex';
import { projectAnswerOf, type ProjectPick } from './projectAnswerOf';
import type { ProjectAsk } from './projectAskOf';
import { ObjectActionVerb } from '../../actions/ObjectActionVerb';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly ask: ProjectAsk;
};

type Candidate = ProjectPick &
  Readonly<{
    projectId: ProjectId;
    line: string;
    isMounted: boolean;
  }>;

type Answered = Readonly<{
  key: string;
  word: string;
}>;

const ANOTHER_LINE = 'Not in this session. A worktree is created from main.';

const JUST_ANSWER = 'No folder, just answer';

type ReplyParams = {
  readonly content: string;
  readonly word: string;
};

type RunParams = {
  readonly label: string;
  readonly work: () => Promise<void>;
};

export const AutoProjectAsk = ({ sessionId, rootAgentId, ask }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((state) => state.projects);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const ensureProjectMounted = useAppStore((state) => state.ensureProjectMounted);
  const [picked, setPicked] = useState<ReadonlyArray<string>>([]);
  const [isAnotherOpen, setIsAnotherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);

  const inSession = useMemo(
    (): ReadonlyArray<Candidate> =>
      mounts.map((mount) => ({
        key: mount.mountId,
        name: projectById(projects, mount.projectId)?.name ?? mount.mountName,
        projectId: mount.projectId,
        line: mount.branch,
        isMounted: true,
      })),
    [mounts, projects],
  );
  const others = useMemo((): ReadonlyArray<Candidate> => {
    const mounted = new Set(mounts.map((mount) => mount.projectId));
    const needle = query.trim().toLowerCase();
    return projects
      .filter((project) => !mounted.has(project.id) && project.kind === 'repo')
      .filter((project) => needle === '' || project.name.toLowerCase().includes(needle))
      .map((project) => ({
        key: project.id,
        name: project.name,
        projectId: project.id,
        line: ANOTHER_LINE,
        isMounted: false,
      }));
  }, [mounts, projects, query]);

  if (answered !== null && answered.key === ask.key) {
    return <p className="text-ui text-muted-foreground">{answered.word}</p>;
  }

  const all = [...inSession, ...others];
  const picks = all.filter((candidate) => picked.includes(candidate.key));
  const answer = projectAnswerOf({ picks, roleNoun: ask.roleNoun });
  const isBusy = busy !== null;

  const toggle = ({ key }: Pick<Candidate, 'key'>) =>
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

  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`Where should the ${ask.roleNoun} work?`}
      body={
        <div className="flex min-w-0 flex-col gap-1">
          {inSession.length === 0 ? null : (
            <p className="text-eyebrow text-muted-foreground">In this session</p>
          )}
          <ul aria-label="Folders" className="flex min-w-0 flex-col">
            {(isAnotherOpen ? all : inSession).map((candidate) => (
              <li key={candidate.key} className="flex h-7 min-w-0 items-center gap-2">
                <Checkbox
                  checked={picked.includes(candidate.key)}
                  disabled={isBusy}
                  ariaLabel={candidate.name}
                  onChange={() => toggle(candidate)}
                  label={
                    <span className="flex min-w-0 items-center gap-2 text-ui">
                      <span className="text-foreground">{candidate.name}</span>
                      <span className="truncate text-faint-foreground">{candidate.line}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          {isAnotherOpen ? (
            <Input
              aria-label="Type a folder name"
              placeholder="Type a folder name"
              value={query}
              disabled={isBusy}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
        </div>
      }
    >
      <FormActions
        error={error}
        leading={
          <span className="flex items-center gap-1">
            {isAnotherOpen ? null : (
              <Button variant="quiet" size="sm" onClick={() => setIsAnotherOpen(true)}>
                Another folder…
              </Button>
            )}
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
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() =>
            void run({
              label: 'No folder',
              work: () =>
                reply({
                  content: 'No folder, just answer in the chat.',
                  word: 'Answered: no folder',
                }),
            })
          }
        >
          {JUST_ANSWER}
        </Button>
        <Button
          size="sm"
          disabled={answer.message === null || isBusy}
          isBusy={isBusy}
          busyLabel={busy ?? answer.label}
          onClick={() => void use()}
        >
          {answer.label}
        </Button>
      </FormActions>
    </Notice>
  );
};
