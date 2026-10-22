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
  Kbd,
  Notice,
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
import { NAMES } from '../../../../shared/names';
import { PromptField } from '../../../../shared/components/PromptField';
import { resolveScopedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { kindRouting } from '../../../session/agent-kind';
import { sessionTitle } from '../../../session/sessionTitle';
import { useAppStore } from '../../../../store';
import { activeChatBackend } from '../../activeChatBackend';
import type { ChatHandoff } from '../../chatHandoff';
import { startWorkFromChat } from '../../startWorkFromChat';
import { openStartRun } from '../../../session/startRun/openStartRun';
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
import { ProjectPicker } from '../../../../shared/components/ProjectPicker';
import { SessionField } from './SessionField';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';

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
    hint: 'Creates a session and opens Start a run with this brief.',
  },
  add: {
    action: 'Add to session',
    hint: 'Opens Start a run in that session with this brief.',
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

export const TURN_INTO_WORK_LABEL = NAMES.startWorkFromChat;

type Landed = {
  readonly sessionId: SessionId;
  readonly ask: string;
  readonly title: string;
  readonly label: string;
};

export const TurnIntoWorkPanel = ({ chat, messages, anchorMessageId, onClose, onDone }: Props) => {
  const allProjects = useAppStore((state) => state.projects);
  const allSessions = useAppStore((state) => state.sessions);
  const createSession = useAppStore((state) => state.createSession);
  const recordChatLink = useAppStore((state) => state.recordChatLink);
  const queueChatLink = useAppStore((state) => state.queueChatLink);
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
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const drafterKey = workDrafterSettingKey({ workspaceId: chat.workspaceId });
  const [brief, setBrief] = useState<WorkBrief | null>(null);
  const [drafter, setDrafter] = useState<WorkDrafterChoice | null>(null);
  const [isDrafterPicked, setIsDrafterPicked] = useState(false);
  const [pickedProjectIds, setProjectIds] = useState<ReadonlyArray<ProjectId> | null>(null);
  const [mode, setMode] = useState<Mode>('new');
  const [sessionId, setSessionId] = useState<SessionId | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState<Landed | null>(null);

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

  const changeDrafter = (choice: WorkDrafterChoice): void => {
    setIsDrafterPicked(true);
    setDrafter(choice);
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

  const finish = (landed: Landed): void => {
    setUnlinked(null);
    onDone({
      id: crypto.randomUUID(),
      label: landed.label,
      title: landed.title,
      sessionId: landed.sessionId,
    });
    openStartRun({ sessionId: landed.sessionId, text: landed.ask });
  };

  const linkThenFinish = async (landed: Landed): Promise<void> => {
    try {
      await recordChatLink({
        chatId: chat.id,
        sessionId: landed.sessionId,
        messageId: anchorMessageId,
        kind: 'new',
      });
    } catch {
      setUnlinked(landed);
      setIsStarting(false);
      return;
    }
    finish(landed);
  };

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
      });
      const landed: Landed = {
        sessionId: started.sessionId,
        ask: started.ask,
        title,
        label:
          mode === 'add' && target !== null
            ? `Draft added to ${sessionTitle({ session: target })}`
            : 'Started a session',
      };
      if (mode === 'add') {
        queueChatLink({
          chatId: chat.id,
          sessionId: started.sessionId,
          messageId: anchorMessageId,
        });
        finish(landed);
        return;
      }
      await linkThenFinish(landed);
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
            <p className="text-meta text-faint-foreground">Drafting from this chat</p>
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
        <div className="flex flex-col gap-3 px-4 pb-3 pt-3">
          <div className="flex flex-col gap-2">
            <span className="text-label text-muted-foreground">Start as</span>
            <SegmentedTabs
              ariaLabel="Start as"
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              size="sm"
              fill
            />
            <p className="text-meta text-faint-foreground">{MODE_COPY[mode].hint}</p>
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
              <label className="flex flex-col gap-2">
                <span className="text-label text-muted-foreground">Title</span>
                <Input
                  value={brief.title}
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-label text-muted-foreground">Goal</span>
                <PromptField
                  kind="document"
                  label="Goal"
                  hasPreview
                  minRows={3}
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
                  <div className="flex flex-col gap-2">
                    <span className="text-label text-muted-foreground">Folder</span>
                    <ProjectPicker
                      projects={projects}
                      value={projectIds}
                      onChange={setProjectIds}
                    />
                  </div>
                </>
              ) : null}
            </>
          )}
          {unlinked === null ? null : (
            <Notice
              tone="danger"
              placement="inline"
              role="alert"
              title="Couldn't link the chat to the session"
              body="The session is ready. The link between them was not saved."
              actions={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void linkThenFinish(unlinked)}
                  >
                    Retry
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => finish(unlinked)}>
                    Open the session
                  </Button>
                </>
              }
            />
          )}
          <FormActions error={error}>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canStart} isBusy={isStarting} onClick={() => void start()}>
              {MODE_COPY[mode].action}
              <Kbd look="inline" aria-hidden>
                {shortcutGlyphs('composer.submit')}
              </Kbd>
            </Button>
          </FormActions>
        </div>
      </ScrollFade>
    </div>
  );
};
