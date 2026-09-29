import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  FormActions,
  formatError,
  IconButton,
  Input,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
  Textarea,
} from '@goodboy/ui';
import type { ChatMessage, ChatMessageId, ChatSummary, ProjectId, SessionId } from '@goodboy/types';
import { sessionTitle } from '../../../session/sessionTitle';
import { useAppStore } from '../../../../store';
import { activeChatBackend } from '../../activeChatBackend';
import type { ChatHandoff } from '../../chatHandoff';
import { startWorkFromChat } from '../../startWorkFromChat';
import { summarizeChatForWork } from '../../summarizeChatForWork';
import type { WorkBrief } from '../../workBrief';
import { BriefItems } from './BriefItems';
import { ProjectField } from './ProjectField';
import { SessionField } from './SessionField';

type Mode = 'new' | 'add';

type Props = {
  readonly chat: ChatSummary;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly anchorMessageId: ChatMessageId | null;
  readonly onClose: () => void;
  readonly onDone: (handoff: ChatHandoff) => void;
};

const MODE_OPTIONS = [
  { value: 'new', label: 'New session' },
  { value: 'add', label: 'Add to a session' },
] as const satisfies ReadonlyArray<{ readonly value: Mode; readonly label: string }>;

const MODE_COPY = {
  new: { action: 'Start session', hint: 'Opens a new session with this brief as its goal.' },
  add: { action: 'Add to session', hint: 'Sends this brief as the next message of a session.' },
} satisfies Record<Mode, { readonly action: string; readonly hint: string }>;

type UpToParams = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly anchorMessageId: ChatMessageId | null;
};

const upTo = ({ messages, anchorMessageId }: UpToParams): ReadonlyArray<ChatMessage> => {
  const index = messages.findIndex((message) => message.id === anchorMessageId);
  return index === -1 ? messages : messages.slice(0, index + 1);
};

export const TURN_INTO_WORK_LABEL = 'Turn into work';

export const TurnIntoWorkPanel = ({ chat, messages, anchorMessageId, onClose, onDone }: Props) => {
  const allProjects = useAppStore((state) => state.projects);
  const allSessions = useAppStore((state) => state.sessions);
  const createSession = useAppStore((state) => state.createSession);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const projects = useMemo(
    () =>
      allProjects.filter(
        (project) =>
          project.workspaceId === chat.workspaceId && project.disconnectedAt === undefined,
      ),
    [allProjects, chat.workspaceId],
  );
  const sessions = useMemo(
    () =>
      allSessions.filter(
        (session) =>
          session.workspaceId === chat.workspaceId &&
          session.archivedAt === undefined &&
          session.deletedAt === undefined,
      ),
    [allSessions, chat.workspaceId],
  );
  const [brief, setBrief] = useState<WorkBrief | null>(null);
  const [pickedProjectIds, setProjectIds] = useState<ReadonlyArray<ProjectId> | null>(null);
  const [mode, setMode] = useState<Mode>('new');
  const [sessionId, setSessionId] = useState<SessionId | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setBrief(null);
    setProjectIds(null);
    void summarizeChatForWork({
      backend: activeChatBackend,
      chat,
      messages: upTo({ messages, anchorMessageId }),
      projectNames: projects.map((project) => project.name),
    }).then((next) => {
      if (!isCurrent) {
        return;
      }
      setBrief(next);
    });
    return () => {
      isCurrent = false;
    };
  }, [chat.id, anchorMessageId]);

  const patch = (next: Partial<WorkBrief>): void =>
    setBrief((current) => (current === null ? current : { ...current, ...next }));

  const projectIds = useMemo(
    () =>
      pickedProjectIds ??
      projects
        .filter((project) => brief?.projects.includes(project.name) === true)
        .map((project) => project.id),
    [pickedProjectIds, projects, brief],
  );
  const target = sessions.find((session) => session.id === sessionId) ?? null;
  const canStart =
    brief !== null &&
    brief.goal.trim() !== '' &&
    !isStarting &&
    (mode === 'new' || target !== null);

  const start = async (): Promise<void> => {
    if (brief === null || !canStart) {
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      const title = brief.title.trim() === '' ? chat.title : brief.title.trim();
      const pickedProjects = projects.filter((project) => projectIds.includes(project.id));
      const started = await startWorkFromChat({
        workspaceId: chat.workspaceId,
        brief: { ...brief, title, projects: pickedProjects.map((project) => project.name) },
        target:
          mode === 'add' && target !== null
            ? { kind: 'add', sessionId: target.id }
            : { kind: 'new', projectIds: pickedProjects.map((project) => project.id) },
        createSession,
        sendTurn,
      });
      onDone({
        id: crypto.randomUUID(),
        label:
          mode === 'add' && target !== null
            ? `Added to ${sessionTitle({ session: target })}`
            : 'Started a session',
        title,
        sessionId: started,
      });
    } catch (failure) {
      setError(formatError(failure));
      setIsStarting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-2 px-4 pb-1 pt-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-heading text-foreground">{TURN_INTO_WORK_LABEL}</h3>
          <p className="text-secondary text-faint-foreground">
            {brief === null ? 'Drafting from this chat' : 'Drafted from this chat. Edit anything.'}
          </p>
        </div>
        <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
      </div>
      <ScrollFade className="flex-1">
        {brief === null ? (
          <div aria-busy className="flex flex-col gap-3 px-4 py-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-4 pt-2.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-label text-muted-foreground">Title</span>
              <Input
                value={brief.title}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-label text-muted-foreground">Goal</span>
              <Textarea
                autoGrow
                minRows={4}
                maxRows={10}
                value={brief.goal}
                onChange={(event) => patch({ goal: event.target.value })}
              />
            </label>
            <BriefItems
              label="What we know"
              items={brief.know}
              emptyLabel="Nothing noted yet"
              removeLabel={(item) => `Remove ${item}`}
              onRemove={(item) => patch({ know: brief.know.filter((entry) => entry !== item) })}
            />
            <BriefItems
              label="Files"
              items={brief.files}
              emptyLabel="No files yet"
              isCode
              removeLabel={(item) => `Remove ${item}`}
              onRemove={(item) => patch({ files: brief.files.filter((entry) => entry !== item) })}
            />
            {mode === 'new' ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">Project</span>
                <ProjectField projects={projects} value={projectIds} onChange={setProjectIds} />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="text-label text-muted-foreground">Start as</span>
              <SegmentedTabs
                ariaLabel="Start as"
                options={MODE_OPTIONS}
                value={mode}
                onChange={setMode}
                size="sm"
                fill
              />
              <p className="text-secondary text-faint-foreground">{MODE_COPY[mode].hint}</p>
              {mode === 'add' ? (
                <SessionField
                  sessions={sessions}
                  projects={projects}
                  value={sessionId}
                  onChange={setSessionId}
                />
              ) : null}
            </div>
            <FormActions error={error}>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!canStart}
                isBusy={isStarting}
                onClick={() => void start()}
              >
                {MODE_COPY[mode].action}
              </Button>
            </FormActions>
          </div>
        )}
      </ScrollFade>
    </div>
  );
};
