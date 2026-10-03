import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import {
  Button,
  FormActions,
  formatError,
  IconButton,
  Input,
  KbdPill,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
} from '@goodboy/ui';
import {
  isChatProvider,
  type ChatMessage,
  type ChatMessageId,
  type ChatSummary,
  type ProjectId,
  type ProviderId,
  type SessionId,
} from '@goodboy/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { PromptField } from '../../../../shared/components/PromptField';
import { resolveScopedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { kindRouting } from '../../../session/agent-kind';
import { sessionTitle } from '../../../session/sessionTitle';
import { useAppStore } from '../../../../store';
import { activeChatBackend } from '../../activeChatBackend';
import type { ChatHandoff } from '../../chatHandoff';
import { landOnSession } from '../../landOnSession';
import { startWorkFromChat, type WorkRouting } from '../../startWorkFromChat';
import { summarizeChatForWork } from '../../summarizeChatForWork';
import type { WorkBrief } from '../../workBrief';
import {
  parseWorkDrafter,
  serializeWorkDrafter,
  workDrafterSettingKey,
  type WorkDrafterChoice,
} from '../../workDrafter';
import { BriefItems } from './BriefItems';
import { DraftedBy } from './DraftedBy';
import { ProjectField } from './ProjectField';
import { RunsOnField } from './RunsOnField';
import { SessionField } from './SessionField';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';

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
  new: {
    action: 'Start session',
    hint: 'Creates a session with this brief as its goal. Nothing runs yet.',
  },
  add: {
    action: 'Add to session',
    hint: 'Puts this brief in that session as a message you send yourself.',
  },
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
  const setSessionConfig = useAppStore((state) => state.setSessionConfig);
  const recordChatLink = useAppStore((state) => state.recordChatLink);
  const navigate = useAppStore((state) => state.navigate);
  const loadPhaseRunsForSession = useAppStore((state) => state.loadPhaseRunsForSession);
  const setAgentDraft = useAppStore((state) => state.setAgentDraft);
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
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const defaultRouting: WorkRouting = useWorkspaceKindRouting({
    workspaceId: chat.workspaceId,
    kind: 'generic',
  });
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const drafterKey = workDrafterSettingKey({ workspaceId: chat.workspaceId });
  const [brief, setBrief] = useState<WorkBrief | null>(null);
  const [drafter, setDrafter] = useState<WorkDrafterChoice | null>(null);
  const [isDrafterPicked, setIsDrafterPicked] = useState(false);
  const [runsOn, setRunsOn] = useState<WorkRouting | null>(null);
  const [pickedProjectIds, setProjectIds] = useState<ReadonlyArray<ProjectId> | null>(null);
  const [mode, setMode] = useState<Mode>('new');
  const [sessionId, setSessionId] = useState<SessionId | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drafterProviders = useMemo<ReadonlyArray<ProviderId>>(() => {
    const offered: ReadonlyArray<ProviderId> = connectedProviders.filter(isChatProvider);
    const current = drafter?.provider ?? chat.provider;
    return offered.includes(current) ? offered : [...offered, current];
  }, [connectedProviders, drafter?.provider, chat.provider]);

  useEffect(() => {
    let isCurrent = true;
    const resolve = async (): Promise<void> => {
      const known = useAppStore.getState().settings?.[drafterKey] ?? null;
      const raw = known ?? (await loadSetting(drafterKey).catch(() => null));
      if (!isCurrent) {
        return;
      }
      setDrafter(parseWorkDrafter({ raw }) ?? { provider: chat.provider, model: chat.model });
    };
    void resolve();
    return () => {
      isCurrent = false;
    };
  }, [chat.id]);

  useEffect(() => {
    if (drafter === null || !isDrafterPicked) {
      return;
    }
    void saveSetting(drafterKey, serializeWorkDrafter({ choice: drafter })).catch(() => undefined);
  }, [drafter?.provider, drafter?.model, drafter?.effort, isDrafterPicked]);

  useEffect(() => {
    if (drafter === null) {
      return undefined;
    }
    let isCurrent = true;
    setBrief(null);
    setProjectIds(null);
    void summarizeChatForWork({
      backend: activeChatBackend,
      chat: {
        title: chat.title,
        provider: drafter.provider,
        model: drafter.model,
        ...(drafter.effort != null && { effort: drafter.effort }),
      },
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
  }, [chat.id, anchorMessageId, drafter?.provider, drafter?.model, drafter?.effort]);

  const changeDrafter = (update: (current: WorkDrafterChoice) => WorkDrafterChoice): void => {
    setIsDrafterPicked(true);
    setDrafter((current) => update(current ?? { provider: chat.provider, model: chat.model }));
  };

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
  const target = sessionById(sessions, sessionId) ?? null;
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
        routing: mode === 'new' ? runsOn : null,
        createSession,
        setSessionConfig,
      });
      await recordChatLink({
        chatId: chat.id,
        sessionId: started.sessionId,
        messageId: anchorMessageId,
        kind: mode,
      }).catch(() => undefined);
      onDone({
        id: crypto.randomUUID(),
        label:
          mode === 'add' && target !== null
            ? `Added to ${sessionTitle({ session: target })}`
            : 'Started a session',
        title,
        sessionId: started.sessionId,
      });
      void landOnSession({
        sessionId: started.sessionId,
        draft: started.draft,
        navigate,
        loadPhaseRunsForSession,
        readAgents: ({ sessionId: id }) => useAppStore.getState().sessionPhaseRuns[id] ?? [],
        readDraft: ({ agentId }) => useAppStore.getState().agentDraft[agentId] ?? '',
        setAgentDraft,
      });
    } catch (failure) {
      setError(formatError(failure));
      setIsStarting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isSubmitChord(event)) {
      event.preventDefault();
      void start();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex shrink-0 items-start gap-2 px-4 pb-1 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-heading text-foreground">{TURN_INTO_WORK_LABEL}</h3>
          {drafter === null ? (
            <p className="text-secondary text-faint-foreground">Drafting from this chat</p>
          ) : (
            <DraftedBy
              choice={drafter}
              connectedProviders={drafterProviders}
              onChange={changeDrafter}
            />
          )}
        </div>
        <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
      </div>
      <ScrollFade className="flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4 pt-2.5">
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
          {brief === null ? (
            <div aria-busy className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">Title</span>
                <Input
                  value={brief.title}
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">Goal</span>
                <PromptField
                  kind="document"
                  label="Goal"
                  hasPreview
                  minRows={4}
                  maxRows={10}
                  value={brief.goal}
                  onChange={(goal) => patch({ goal })}
                />
              </div>
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
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-label text-muted-foreground">Project</span>
                    <ProjectField projects={projects} value={projectIds} onChange={setProjectIds} />
                  </div>
                  <RunsOnField
                    connectedProviders={connectedProviders}
                    defaultRouting={defaultRouting}
                    value={runsOn}
                    onChange={(update) => setRunsOn(update)}
                  />
                </>
              ) : null}
            </>
          )}
          <FormActions error={error}>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canStart} isBusy={isStarting} onClick={() => void start()}>
              {MODE_COPY[mode].action}
              <KbdPill aria-hidden>{shortcutGlyphs('composer.submit')}</KbdPill>
            </Button>
          </FormActions>
        </div>
      </ScrollFade>
    </div>
  );
};
