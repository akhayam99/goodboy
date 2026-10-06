import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronRight, List } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { Divider, Eyebrow, ScrollFade, FilledEmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { parseQuery } from '../../../quick-actions/grammar';
import {
  buildActionList,
  buildChoiceList,
  buildCommandList,
  defaultCommandKey,
  flattenRows,
  type CommandRow,
} from '../../commandList';
import { ASK_IN_CHAT_KEY, askEntry } from '../../sources/askEntry';
import { choiceEntries } from '../../sources/choiceEntries';
import { askInChat } from '../../../workspace-chat/askInChat';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { readFrecency, recordPaletteUse } from '../../frecencyStorage';
import { useCommandEntries } from '../../hooks/useCommandEntries';
import { useNeedsYouEntries } from '../../hooks/useNeedsYouEntries';
import type { SessionPalette } from '../../hooks/useSessionPalette';
import { useStartRun } from '../../hooks/useStartRun';
import { runObjectAction } from '../../../actions/registry';
import {
  ALL_CHOICES_ID,
  type ActionConfirm,
  type ObjectTarget,
  type ResolvedAction,
} from '../../../actions/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { sessionTitle } from '../../../session/sessionTitle';
import type { PaletteModeProps } from '../../paletteModeTypes';
import { verbEntries, type VerbSelectParams } from '../../sources/verbEntries';
import { liveAgentVerbs } from '../../sources/liveAgentEntries';
import { runRow, runSection } from '../../sources/runEntries';
import {
  runConfirmFacts,
  startRunEntry,
  workflowChoiceEntries,
} from '../../sources/workflowEntries';
import type { PaletteEntry, PaletteScope } from '../../types';
import { PaletteInputRow } from '../PaletteOverlay/PaletteInputRow';
import { ScopeChip } from '../PaletteOverlay/ScopeChip';
import { CommandRowView } from './CommandRowView';
import { EntryPreview } from './EntryPreview';
import { PreviewHints } from './PreviewHints';
import { StartRunConfirm } from './StartRunConfirm';
import { useScopeInfo } from './useScopeInfo';
import { VerbConfirm } from './VerbConfirm';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Level = {
  readonly target: ObjectTarget | null;
  readonly title: string;
  readonly key: string;
  readonly choicesOf: ResolvedAction | null;
  readonly isStartRun: boolean;
};

type RunVerbParams = {
  readonly target: ObjectTarget;
  readonly actionId: string;
};

type Props = PaletteModeProps & {
  readonly palette: SessionPalette | null;
};

const DEFAULT_PLACEHOLDER = 'Search or ask';

const ALL_ACTIONS_KEY = 'level:session-actions';

const sessionIdOf = (scope: PaletteScope | null): SessionId | null =>
  scope !== null &&
  (scope.kind === 'session' ||
    scope.kind === 'agent' ||
    scope.kind === 'workflowRun' ||
    scope.kind === 'pullRequest')
    ? scope.sessionId
    : null;

const REGISTRY_LENS_KEYS: ReadonlySet<string> = new Set([
  'lens:review',
  'lens:files',
  'lens:terminal',
]);

const confirmOf = (entry: PaletteEntry): ActionConfirm | null =>
  entry.confirm ?? entry.action?.confirm ?? null;

const isCaretAtEnd = (input: HTMLInputElement): boolean =>
  input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

export const CommandsBody = ({
  query,
  onQueryChange,
  scope,
  onClearScope,
  onSwitchMode,
  onClose,
  modeSwitch,
  palette,
}: Props) => {
  const env = useActionEnv({ origin: 'palette' });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const [frecency] = useState(readFrecency);
  const [now] = useState(() => Date.now());
  const [level, setLevel] = useState<Level | null>(null);
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState<PaletteEntry | null>(null);
  const [confirmingRun, setConfirmingRun] = useState<PaletteEntry | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scopeInfo = useScopeInfo(scope);
  const scopeTarget: ObjectTarget | null =
    scope === null || scope.kind === 'workspace' ? null : scope;
  const scopeActions = useObjectActions({ target: scopeTarget, env });
  const scopeSessionId = sessionIdOf(scope);
  const parentTarget = useMemo<ObjectTarget | null>(
    () =>
      scopeSessionId !== null && scope?.kind !== 'session'
        ? { kind: 'session', sessionId: scopeSessionId }
        : null,
    [scope?.kind, scopeSessionId],
  );
  const parentActions = useObjectActions({ target: parentTarget, env });
  const levelActions = useObjectActions({ target: level?.target ?? null, env });
  const entries = useCommandEntries();
  const needsYou = useNeedsYouEntries();
  const { workflows, start: startRun } = useStartRun();
  const hasWorkspace = useAppStore((state) => state.currentWorkspaceId !== null);
  const activePalette = scopeSessionId === null ? null : palette;
  const runTarget = scope?.kind === 'workflowRun' ? null : (activePalette?.run?.target ?? null);
  const liveTarget = scope?.kind === 'agent' ? null : (activePalette?.liveAgent?.target ?? null);
  const pullRequestTarget =
    scope?.kind === 'pullRequest' ? null : (activePalette?.pullRequest ?? null);
  const runActions = useObjectActions({ target: runTarget, env });
  const liveActions = useObjectActions({ target: liveTarget, env });
  const pullRequestActions = useObjectActions({ target: pullRequestTarget, env });
  const runSession = useAppStore((state) =>
    palette === null ? null : sessionById(state.sessions, palette.sessionId),
  );
  const runMounts = useAppStore((state) =>
    palette === null ? EMPTY_ARRAY : (state.sessionProjectMounts[palette.sessionId] ?? EMPTY_ARRAY),
  );
  const runSessionTitle = runSession === null ? '' : sessionTitle({ session: runSession });
  const projectNames = runMounts.map((mount) => mount.mountName);

  const runVerb = useCallback(
    ({ target, actionId }: RunVerbParams) => {
      void runObjectAction({ target, actionId, env });
    },
    [env],
  );

  const scopeVerbs = useMemo(
    () =>
      scopeTarget === null
        ? []
        : verbEntries({
            target: scopeTarget,
            actions: scopeActions.actions,
            isScope: true,
            noun: scopeInfo?.noun ?? '',
            select: ({ action }: VerbSelectParams) =>
              runVerb({ target: scopeTarget, actionId: action.id }),
          }),
    [scopeTarget, scopeActions.actions, scopeInfo?.noun, runVerb],
  );

  const parentVerbs = useMemo(() => {
    if (parentTarget === null) {
      return [];
    }
    const scopeLabels = new Set(scopeVerbs.map((entry) => entry.label));
    return verbEntries({
      target: parentTarget,
      actions: parentActions.actions,
      isScope: false,
      noun: parentActions.noun ?? '',
      select: ({ action }: VerbSelectParams) =>
        runVerb({ target: parentTarget, actionId: action.id }),
    }).filter((entry) => !scopeLabels.has(entry.label));
  }, [parentTarget, parentActions.actions, parentActions.noun, scopeVerbs, runVerb]);

  const levelVerbs = useMemo(() => {
    const target = level?.target ?? null;
    return target === null
      ? []
      : verbEntries({
          target,
          actions: levelActions.actions,
          isScope: false,
          noun: levelActions.noun ?? '',
          select: ({ action }: VerbSelectParams) => runVerb({ target, actionId: action.id }),
        });
  }, [level, levelActions.actions, levelActions.noun, runVerb]);

  const levelChoices = useMemo(() => {
    const target = level?.target ?? null;
    return level === null || level.choicesOf === null || target === null
      ? []
      : choiceEntries({
          target,
          action: level.choicesOf,
          select: ({ choice }) => {
            void runObjectAction({
              target,
              actionId: level.choicesOf?.id ?? '',
              env,
              choice,
            });
          },
        });
  }, [level, env]);

  const levelWorkflows = useMemo(
    () => (level?.isStartRun === true ? workflowChoiceEntries({ workflows, start: startRun }) : []),
    [level?.isStartRun, workflows, startRun],
  );

  const liveVerbs = useMemo(
    () =>
      liveTarget === null || activePalette?.liveAgent == null
        ? []
        : liveAgentVerbs({
            verbs: verbEntries({
              target: liveTarget,
              actions: liveActions.actions,
              isScope: true,
              noun: liveActions.noun ?? '',
              select: ({ action }: VerbSelectParams) =>
                runVerb({ target: liveTarget, actionId: action.id }),
            }),
            name: activePalette.liveAgent.name,
          }),
    [liveTarget, liveActions.actions, liveActions.noun, activePalette?.liveAgent, runVerb],
  );

  const runVerbs = useMemo(
    () =>
      runTarget === null
        ? []
        : verbEntries({
            target: runTarget,
            actions: runActions.actions,
            isScope: false,
            noun: 'run',
            select: ({ action }: VerbSelectParams) =>
              runVerb({ target: runTarget, actionId: action.id }),
          }),
    [runTarget, runActions.actions, runVerb],
  );

  const pullRequestVerbs = useMemo(
    () =>
      pullRequestTarget === null
        ? []
        : verbEntries({
            target: pullRequestTarget,
            actions: pullRequestActions.actions,
            isScope: false,
            noun: 'pull request',
            select: ({ action }: VerbSelectParams) =>
              runVerb({ target: pullRequestTarget, actionId: action.id }),
          }),
    [pullRequestTarget, pullRequestActions.actions, runVerb],
  );

  const sessionList = useMemo(
    () => (scope?.kind === 'session' ? [...scopeVerbs, ...liveVerbs] : scopeVerbs),
    [scope?.kind, scopeVerbs, liveVerbs],
  );
  const parentList = useMemo(
    () => (parentTarget === null ? parentVerbs : [...parentVerbs, ...liveVerbs]),
    [parentTarget, parentVerbs, liveVerbs],
  );

  const allActions = useMemo<PaletteEntry | null>(
    () =>
      scopeSessionId === null || activePalette === null
        ? null
        : {
            key: ALL_ACTIONS_KEY,
            label: 'All actions for this session',
            kind: 'level',
            group: null,
            icon: List,
            level: { kind: 'actions', target: { kind: 'session', sessionId: scopeSessionId } },
            run: () => undefined,
          },
    [scopeSessionId, activePalette],
  );

  const runs = useMemo(() => {
    if (activePalette === null) {
      return [];
    }
    const open = () => {
      const target = activePalette.run?.target ?? null;
      if (target !== null) {
        runVerb({ target, actionId: 'workflowRun.open' });
      }
    };
    const startRunLevel = startRunEntry({ workflows });
    if (activePalette.run === null && startRunLevel === null) {
      return [];
    }
    return runSection({
      row:
        activePalette.run === null || scope?.kind === 'workflowRun'
          ? null
          : runRow({ facts: activePalette.run.facts, open }),
      verbs: runVerbs,
      startRun: startRunLevel,
      openRuns: entries.find((entry) => entry.key === 'lens:workflows') ?? null,
    });
  }, [activePalette, scope?.kind, runVerbs, workflows, entries, runVerb]);

  const extra = useMemo(() => {
    const taken = new Set([...sessionList, ...parentList].map((entry) => entry.label));
    return [
      ...(activePalette?.next ?? []),
      ...runs,
      ...pullRequestVerbs.filter((entry) => !taken.has(entry.label)),
    ];
  }, [activePalette?.next, runs, pullRequestVerbs, sessionList, parentList]);

  const pool = useMemo(() => {
    const runsKeys = new Set(runs.map((entry) => entry.key));
    const verbLabels = new Set([...sessionList, ...parentList].map((entry) => entry.label));
    const isSessionScope = scopeTarget?.kind === 'session' || parentTarget !== null;
    return entries.filter(
      (entry) =>
        !runsKeys.has(entry.key) &&
        !((entry.kind === 'action' || entry.kind === 'page') && verbLabels.has(entry.label)) &&
        !(isSessionScope && REGISTRY_LENS_KEYS.has(entry.key)),
    );
  }, [entries, runs, sessionList, parentList, scopeTarget, parentTarget]);

  const ask = useMemo(
    () =>
      hasWorkspace && query.trim() !== '' && parseQuery(query).prefix === null
        ? askEntry({ query, ask: (question) => void askInChat({ question }) })
        : null,
    [hasWorkspace, query],
  );

  const sections = useMemo(
    () =>
      level === null
        ? buildCommandList({
            query,
            entries: pool,
            scopeVerbs: sessionList,
            scopeTitle: scopeInfo === null ? null : `For this ${scopeInfo.noun}`,
            scopeKey: scopeInfo?.key ?? null,
            parentVerbs: parentList,
            parentTitle: parentTarget === null ? null : 'For this session',
            frecency,
            now,
            ask,
            tier: activePalette?.tier ?? null,
            isScopeSession: scope?.kind === 'session',
            allActions,
            next: activePalette?.next ?? [],
            runs,
            needsYou: scope?.kind === 'workspace' ? needsYou : [],
            extra,
          })
        : level.isStartRun
          ? buildChoiceList({
              query: filter,
              title: 'From a workflow',
              choices: levelWorkflows,
              frecency,
              now,
            })
          : level.choicesOf !== null
            ? buildChoiceList({
                query: filter,
                title: level.choicesOf.label,
                choices: levelChoices,
                frecency,
                now,
              })
            : buildActionList({ query: filter, verbs: levelVerbs, frecency, now }),
    [
      level,
      query,
      pool,
      sessionList,
      parentList,
      parentTarget,
      scopeInfo,
      frecency,
      now,
      ask,
      activePalette,
      scope?.kind,
      allActions,
      runs,
      needsYou,
      extra,
      filter,
      levelVerbs,
      levelChoices,
      levelWorkflows,
    ],
  );
  const rows = useMemo(() => flattenRows(sections), [sections]);
  const activeKey =
    selectedKey ??
    (level === null ? defaultCommandKey({ query, rows, askKey: ASK_IN_CHAT_KEY }) : null);
  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.item.key === activeKey),
  );
  const selected: CommandRow | null = rows[selectedIndex] ?? null;
  const optionId = (key: string): string => `${listboxId}-${key}`;

  useEffect(() => {
    setSelectedKey(null);
  }, [query, filter, level]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [level, confirming, confirmingRun]);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-key="${CSS.escape(selected.item.key)}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const subject = level?.title ?? scopeInfo?.title ?? null;
  const allChoice = levelChoices.find((entry) => entry.key.endsWith(`:${ALL_CHOICES_ID}`)) ?? null;

  const finish = (entry: PaletteEntry): void => {
    const at = Date.now();
    recordPaletteUse({ key: entry.key, now: at });
    if (level !== null) {
      recordPaletteUse({ key: level.key, now: at });
    }
    onClose();
    entry.run();
  };

  const openLevel = (entry: PaletteEntry): void => {
    const request = entry.level;
    if (request === undefined) {
      return;
    }
    if (request.kind === 'confirm-run') {
      setConfirmingRun(entry);
      return;
    }
    setLevel({
      target: request.kind === 'actions' ? request.target : null,
      title: entry.label,
      key: entry.key,
      choicesOf: null,
      isStartRun: request.kind === 'start-run',
    });
    setFilter('');
  };

  const activate = (entry: PaletteEntry): void => {
    if (entry.isBlocked === true) {
      return;
    }
    if (entry.level !== undefined) {
      openLevel(entry);
      return;
    }
    if (confirmOf(entry) !== null) {
      setConfirming(entry);
      return;
    }
    if (
      entry.action != null &&
      (entry.action.choices?.length ?? 0) > 0 &&
      entry.target !== undefined
    ) {
      setLevel({
        target: entry.target,
        title: entry.label,
        key: level?.key ?? scopeInfo?.key ?? entry.key,
        choicesOf: entry.action,
        isStartRun: false,
      });
      setFilter('');
      return;
    }
    finish(entry);
  };

  const openActions = (entry: PaletteEntry): void => {
    if (entry.level !== undefined && entry.level.kind !== 'confirm-run') {
      openLevel(entry);
      return;
    }
    if (entry.target === undefined || entry.kind === 'verb') {
      return;
    }
    setLevel({
      target: entry.target,
      title: entry.label,
      key: entry.key,
      choicesOf: null,
      isStartRun: false,
    });
    setFilter('');
  };

  const back = (): void => {
    setLevel(null);
    setFilter('');
  };

  const move = (delta: number): void => {
    const next = rows[Math.min(Math.max(selectedIndex + delta, 0), rows.length - 1)];
    if (next !== undefined) {
      setSelectedKey(next.item.key);
    }
  };

  const altOf = (entry: PaletteEntry): PaletteEntry | null => {
    const altId = confirmOf(entry)?.altActionId;
    if (altId === undefined) {
      return null;
    }
    const verbs = level === null ? [...sessionList, ...parentList, ...runVerbs] : levelVerbs;
    return verbs.find((candidate) => candidate.action?.id === altId) ?? null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const value = event.currentTarget.value;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Enter':
        event.preventDefault();
        if (confirmingRun !== null) {
          finish(confirmingRun);
          return;
        }
        if (confirming !== null) {
          finish(confirming);
          return;
        }
        if ((event.metaKey || event.ctrlKey) && allChoice !== null) {
          finish(allChoice);
          return;
        }
        if (selected !== null) {
          activate(selected.item);
        }
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (confirmingRun !== null) {
          setConfirmingRun(null);
          return;
        }
        if (confirming !== null) {
          setConfirming(null);
          return;
        }
        if (level !== null) {
          back();
          return;
        }
        onClose();
        return;
      case 'ArrowRight': {
        if (level !== null || confirmingRun !== null || selected === null) {
          return;
        }
        if (!isCaretAtEnd(event.currentTarget)) {
          return;
        }
        const opensLevel =
          selected.item.level !== undefined && selected.item.level.kind !== 'confirm-run';
        if (!opensLevel && (selected.item.target === undefined || selected.item.kind === 'verb')) {
          return;
        }
        event.preventDefault();
        openActions(selected.item);
        return;
      }
      case 'ArrowLeft':
        if (confirmingRun !== null) {
          event.preventDefault();
          setConfirmingRun(null);
          return;
        }
        if (level === null || value !== '') {
          return;
        }
        event.preventDefault();
        back();
        return;
      case 'Backspace':
        if (value !== '') {
          return;
        }
        if (level !== null) {
          event.preventDefault();
          back();
          return;
        }
        if (scope !== null) {
          event.preventDefault();
          onClearScope();
        }
        return;
      case 'Tab':
        event.preventDefault();
        if (confirming === null && confirmingRun === null && level === null) {
          onSwitchMode();
        }
        return;
      default:
        return;
    }
  };

  const prefix = parseQuery(query).prefix;
  const placeholder =
    level !== null
      ? level.isStartRun
        ? 'Pick a workflow'
        : 'Filter actions…'
      : prefix !== null
        ? `Search ${prefix.hint}…`
        : DEFAULT_PLACEHOLDER;
  const chip =
    level !== null ? (
      <ScopeChip icon={ChevronRight} label={level.title} hint="← or Backspace goes back" />
    ) : scopeInfo !== null ? (
      <ScopeChip icon={scopeInfo.icon} label={scopeInfo.title} hint="Backspace removes the scope" />
    ) : null;
  const alt = confirming === null ? null : altOf(confirming);
  const pendingConfirm = confirming === null ? null : confirmOf(confirming);
  const runLevel = confirmingRun?.level ?? null;
  const confirmingRunWorkflow =
    runLevel?.kind === 'confirm-run'
      ? (workflows.find((workflow) => workflow.id === runLevel.workflowId) ?? null)
      : null;

  return (
    <>
      <PaletteInputRow
        inputRef={inputRef}
        value={level === null ? query : filter}
        placeholder={placeholder}
        ariaLabel="Command palette search"
        listboxId={listboxId}
        activeDescendant={selected === null ? undefined : optionId(selected.item.key)}
        chip={chip}
        modeSwitch={modeSwitch}
        onChange={level === null ? onQueryChange : setFilter}
        onKeyDown={onKeyDown}
      />
      <Divider />
      {confirmingRun !== null && confirmingRunWorkflow !== null ? (
        <StartRunConfirm
          entry={confirmingRun}
          workflowName={confirmingRunWorkflow.name}
          facts={runConfirmFacts({
            workflow: confirmingRunWorkflow,
            sessionTitle: runSessionTitle,
            projectNames,
          })}
          onConfirm={() => finish(confirmingRun)}
          onCancel={() => setConfirmingRun(null)}
        />
      ) : confirming !== null && pendingConfirm !== null ? (
        <VerbConfirm
          entry={confirming}
          confirm={pendingConfirm}
          subject={subject}
          altLabel={alt?.label ?? null}
          onConfirm={() => finish(confirming)}
          onAlt={() => {
            if (alt !== null) {
              finish(alt);
            }
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ScrollFade className="max-h-[420px] min-h-0 min-w-0 flex-1" fadeFrom="floating">
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Commands"
              className="flex flex-col gap-0.5 p-2"
            >
              {rows.length === 0 ? (
                <li role="presentation">
                  <FilledEmptyState
                    icon={CONCEPT_ICONS.search}
                    tone={CONCEPT_TONE.search}
                    title={
                      (level === null ? query : filter).trim() === ''
                        ? 'Nothing to do here yet'
                        : `Nothing matches “${(level === null ? query : filter).trim()}”`
                    }
                    className="justify-center"
                  />
                </li>
              ) : (
                sections.flatMap((section, sectionIndex) => [
                  ...(section.title === null
                    ? []
                    : [
                        <li
                          key={`section:${section.title}`}
                          role="presentation"
                          className="flex h-8 items-end px-3"
                        >
                          <Eyebrow label={section.title} />
                        </li>,
                      ]),
                  ...section.rows.map((row) => (
                    <CommandRowView
                      key={`${sectionIndex}:${row.item.key}`}
                      row={row}
                      id={optionId(row.item.key)}
                      isSelected={row.item.key === selected?.item.key}
                      onHover={() => setSelectedKey(row.item.key)}
                      onRun={() => activate(row.item)}
                    />
                  )),
                ])
              )}
            </ul>
          </ScrollFade>
          {selected !== null && (
            <>
              <Divider orientation="vertical" className="hidden md:block" />
              <aside
                aria-label="Preview"
                className="hidden w-72 shrink-0 flex-col justify-between gap-4 p-4 md:flex"
              >
                <EntryPreview entry={selected.item} subject={subject} />
                <PreviewHints
                  entry={selected.item}
                  isActionsLevel={level !== null}
                  allLabel={allChoice?.label ?? null}
                  hasOtherModes={modeSwitch !== null}
                />
              </aside>
            </>
          )}
        </div>
      )}
    </>
  );
};
