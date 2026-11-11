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
import { Divider } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { parseQuery } from '../../../quick-actions/grammar';
import {
  buildActionList,
  buildChoiceList,
  buildCommandList,
  defaultCommandKey,
  flattenRows,
  type CommandRow,
} from '../../commandList';
import { ASK_KEYS, askEntries } from '../../sources/askEntries';
import { choiceEntries } from '../../sources/choiceEntries';
import { useAppStore } from '../../../../store';
import { readFrecency, recordPaletteUse } from '../../frecencyStorage';
import { useBrowserEntries } from '../../hooks/useBrowserEntries';
import { useCommandEntries } from '../../hooks/useCommandEntries';
import { useListboxCursor } from '../../../../shared/hooks/useListboxCursor';
import { useNeedsYouEntries } from '../../hooks/useNeedsYouEntries';
import type { SessionPalette } from '../../hooks/useSessionPalette';
import { runObjectAction } from '../../../actions/registry';
import {
  ALL_CHOICES_ID,
  type ActionConfirm,
  type ObjectTarget,
  type ResolvedAction,
} from '../../../actions/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { PaletteModeProps } from '../../paletteModeTypes';
import { verbEntries, type VerbSelectParams } from '../../sources/verbEntries';
import { hasOwnPreviewOf, paletteBodyLayoutOf, paletteListMaxHeightOf } from './paletteBodyLayout';
import { liveAgentVerbs, sessionOwnFirst } from '../../sources/liveAgentEntries';
import { runRow, runSection } from '../../sources/runEntries';
import type { PaletteEntry } from '../../types';
import { PaletteInputRow } from '../PaletteOverlay/PaletteInputRow';
import { ScopeChip } from '../PaletteOverlay/ScopeChip';
import { CommandsList } from './CommandsList';
import { EntryPreview } from './EntryPreview';
import { PreviewHints } from './PreviewHints';
import { sessionIdOfScope } from './sessionIdOfScope';
import { useIsScopeLoaded } from './useIsScopeLoaded';
import { useScopeInfo } from './useScopeInfo';
import { VerbConfirm } from './VerbConfirm';

type Level = {
  readonly target: ObjectTarget | null;
  readonly title: string;
  readonly key: string;
  readonly choicesOf: ResolvedAction | null;
};

type RunVerbParams = {
  readonly target: ObjectTarget;
  readonly actionId: string;
};

type Props = PaletteModeProps & {
  readonly palette: SessionPalette | null;
};

const NO_ASKS: ReadonlyArray<PaletteEntry> = [];

const ALL_ACTIONS_KEY = 'level:session-actions';

const REGISTRY_LENS_KEYS: ReadonlySet<string> = new Set(['lens:review', 'lens:files']);

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

  const scopeInfo = useScopeInfo(scope);
  const scopeTarget: ObjectTarget | null =
    scope === null || scope.kind === 'workspace' ? null : scope;
  const scopeActions = useObjectActions({ target: scopeTarget, env });
  const scopeSessionId = sessionIdOfScope({ scope });
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
  const askSessionId =
    scopeTarget?.kind === 'session'
      ? scopeTarget.sessionId
      : parentTarget?.kind === 'session'
        ? parentTarget.sessionId
        : null;
  const browser = useBrowserEntries({ query, scopeSessionId: askSessionId });
  const hasWorkspace = useAppStore((state) => state.currentWorkspaceId !== null);
  const isScopeLoaded = useIsScopeLoaded({ scopeSessionId });
  const activePalette = scopeSessionId === null ? null : palette;
  const runTarget = scope?.kind === 'workflowRun' ? null : (activePalette?.run?.target ?? null);
  const liveTarget = scope?.kind === 'agent' ? null : (activePalette?.liveAgent?.target ?? null);
  const pullRequestTarget =
    scope?.kind === 'pullRequest' ? null : (activePalette?.pullRequest ?? null);
  const taskTarget = activePalette?.task ?? null;
  const taskActions = useObjectActions({ target: taskTarget, env });
  const runActions = useObjectActions({ target: runTarget, env });
  const liveActions = useObjectActions({ target: liveTarget, env });
  const pullRequestActions = useObjectActions({ target: pullRequestTarget, env });

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
            name: activePalette.liveAgent.role,
            title: activePalette.liveAgent.name,
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

  const taskVerbs = useMemo(
    () =>
      taskTarget === null
        ? []
        : verbEntries({
            target: taskTarget,
            actions: taskActions.actions.filter((action) => action.id === 'task.moveTo'),
            isScope: false,
            noun: 'issue',
            select: ({ action }: VerbSelectParams) =>
              runVerb({ target: taskTarget, actionId: action.id }),
          }),
    [taskTarget, taskActions.actions, runVerb],
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
    if (activePalette.run === null) {
      return [];
    }
    return runSection({
      row: scope?.kind === 'workflowRun' ? null : runRow({ facts: activePalette.run.facts, open }),
      verbs: runVerbs,
      openRuns: entries.find((entry) => entry.key === 'lens:workflows') ?? null,
    });
  }, [activePalette, scope?.kind, runVerbs, entries, runVerb]);

  const extra = useMemo(() => {
    const taken = new Set([...sessionList, ...parentList].map((entry) => entry.label));
    return [
      ...(activePalette?.next ?? []),
      ...runs,
      ...pullRequestVerbs.filter((entry) => !taken.has(entry.label)),
      ...taskVerbs.filter((entry) => !taken.has(entry.label)),
    ];
  }, [activePalette?.next, runs, pullRequestVerbs, taskVerbs, sessionList, parentList]);

  const pool = useMemo(() => {
    const runsKeys = new Set(runs.map((entry) => entry.key));
    const verbLabels = new Set([...sessionList, ...parentList].map((entry) => entry.label));
    const isSessionScope = scopeTarget?.kind === 'session' || parentTarget !== null;
    return [...entries, ...browser.tabs].filter(
      (entry) =>
        !runsKeys.has(entry.key) &&
        !(
          (entry.kind === 'action' || entry.kind === 'create' || entry.kind === 'page') &&
          verbLabels.has(entry.label)
        ) &&
        !(isSessionScope && REGISTRY_LENS_KEYS.has(entry.key)),
    );
  }, [entries, browser.tabs, runs, sessionList, parentList, scopeTarget, parentTarget]);

  const asks = useMemo(
    () =>
      query.trim() !== '' && parseQuery(query).prefix === null
        ? askEntries({ query, sessionId: askSessionId, leading: browser.opens, hasWorkspace })
        : NO_ASKS,
    [askSessionId, browser.opens, hasWorkspace, query],
  );

  const builtSections = useMemo(
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
            asks,
            tier: activePalette?.tier ?? null,
            isScopeSession: scope?.kind === 'session',
            allActions,
            next: activePalette?.next ?? [],
            runs,
            needsYou: scope?.kind === 'workspace' ? needsYou : [],
            extra,
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
      asks,
      activePalette,
      scope?.kind,
      allActions,
      runs,
      needsYou,
      extra,
      filter,
      levelVerbs,
      levelChoices,
    ],
  );
  const sections = useMemo(
    () =>
      sessionOwnFirst({
        scopeKind: scope?.kind ?? null,
        isIdle: level === null && query.trim() === '',
        sections: builtSections,
      }),
    [scope?.kind, level, query, builtSections],
  );
  const rows = useMemo(() => flattenRows(sections), [sections]);
  const listMaxHeight = useMemo(
    () =>
      paletteListMaxHeightOf({
        sections: sections.map((section) => ({
          hasTitle: section.title !== null,
          rowCount: section.rows.length,
        })),
      }),
    [sections],
  );
  const rowKeys = useMemo(() => rows.map((row) => row.item.key), [rows]);
  const cursor = useListboxCursor({
    ids: rowKeys,
    listRef,
    listboxId,
    defaultId: level === null ? defaultCommandKey({ query, rows, askKeys: ASK_KEYS }) : null,
  });
  const { optionId, select: selectRow } = cursor;
  const selected: CommandRow | null = rows[cursor.selectedIndex] ?? null;

  useEffect(() => {
    selectRow({ id: null });
  }, [query, filter, level, selectRow]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [level, confirming]);

  const subject = level?.title ?? scopeInfo?.title ?? null;
  const layout = paletteBodyLayoutOf({
    hasPreview: selected !== null && hasOwnPreviewOf({ entry: selected.item }),
  });
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
    setLevel({
      target: request.target,
      title: entry.label,
      key: entry.key,
      choicesOf: null,
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
      });
      setFilter('');
      return;
    }
    finish(entry);
  };

  const openActions = (entry: PaletteEntry): void => {
    if (entry.level !== undefined) {
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
    });
    setFilter('');
  };

  const back = (): void => {
    setLevel(null);
    setFilter('');
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
        cursor.move({ delta: 1 });
        return;
      case 'ArrowUp':
        event.preventDefault();
        cursor.move({ delta: -1 });
        return;
      case 'Enter':
        event.preventDefault();
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
        if (level !== null || selected === null) {
          return;
        }
        if (!isCaretAtEnd(event.currentTarget)) {
          return;
        }
        const opensLevel = selected.item.level !== undefined;
        if (!opensLevel && (selected.item.target === undefined || selected.item.kind === 'verb')) {
          return;
        }
        event.preventDefault();
        openActions(selected.item);
        return;
      }
      case 'ArrowLeft':
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
        if (confirming === null && level === null) {
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
      ? 'Filter actions…'
      : prefix !== null
        ? `Search ${prefix.hint}…`
        : NAMES.searchOrRun;
  const chip =
    level !== null ? (
      <ScopeChip icon={ChevronRight} label={level.title} hint="← or Backspace goes back" />
    ) : scopeInfo !== null ? (
      <ScopeChip icon={scopeInfo.icon} label={scopeInfo.title} hint="Backspace removes the scope" />
    ) : null;
  const alt = confirming === null ? null : altOf(confirming);
  const pendingConfirm = confirming === null ? null : confirmOf(confirming);

  return (
    <>
      <PaletteInputRow
        inputRef={inputRef}
        value={level === null ? query : filter}
        placeholder={placeholder}
        ariaLabel={NAMES.searchOrRun}
        listboxId={listboxId}
        activeDescendant={selected === null ? undefined : optionId({ id: selected.item.key })}
        chip={chip}
        modeSwitch={modeSwitch}
        onChange={level === null ? onQueryChange : setFilter}
        onKeyDown={onKeyDown}
      />
      <Divider />
      {confirming !== null && pendingConfirm !== null ? (
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
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <CommandsList
              listRef={listRef}
              listboxId={listboxId}
              maxHeight={listMaxHeight}
              sections={sections}
              selectedKey={selected?.item.key ?? null}
              query={level === null ? query : filter}
              isLoaded={isScopeLoaded}
              gateKey={scopeInfo?.key ?? 'workspace'}
              optionId={optionId}
              onSelect={selectRow}
              onRun={activate}
            />
            {selected !== null && layout.previewShown && (
              <>
                <Divider orientation="vertical" className="hidden md:block" />
                <aside
                  aria-label="Preview"
                  className="hidden w-64 shrink-0 flex-col justify-between gap-3 p-3 md:flex"
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
          {selected !== null && !layout.previewShown && (
            <div className="px-3 py-1">
              <PreviewHints
                entry={selected.item}
                isActionsLevel={level !== null}
                allLabel={allChoice?.label ?? null}
                hasOtherModes={modeSwitch !== null}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};
