import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronRight } from 'lucide-react';
import { Divider, EmptyState, Eyebrow, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { parseQuery } from '../../../quick-actions/grammar';
import {
  buildActionList,
  buildChoiceList,
  buildCommandList,
  flattenRows,
  type CommandRow,
} from '../../commandList';
import { choiceEntries } from '../../sources/choiceEntries';
import { readFrecency, recordPaletteUse } from '../../frecencyStorage';
import { useCommandEntries } from '../../hooks/useCommandEntries';
import { runObjectAction } from '../../../actions/registry';
import type { ObjectTarget, ResolvedAction } from '../../../actions/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { PaletteModeProps } from '../../paletteModeTypes';
import { verbEntries, type VerbSelectParams } from '../../sources/verbEntries';
import type { PaletteEntry } from '../../types';
import { PaletteInputRow } from '../PaletteOverlay/PaletteInputRow';
import { ScopeChip } from '../PaletteOverlay/ScopeChip';
import { CommandRowView } from './CommandRowView';
import { EntryPreview } from './EntryPreview';
import { PreviewHints } from './PreviewHints';
import { useScopeInfo } from './useScopeInfo';
import { VerbConfirm } from './VerbConfirm';

type Level = {
  readonly target: ObjectTarget;
  readonly title: string;
  readonly key: string;
  readonly choicesOf: ResolvedAction | null;
};

type RunVerbParams = {
  readonly target: ObjectTarget;
  readonly actionId: string;
};

const DEFAULT_PLACEHOLDER = 'Type a command or a name';

const REGISTRY_LENS_KEYS: ReadonlySet<string> = new Set([
  'lens:review',
  'lens:files',
  'lens:terminal',
]);

const isCaretAtEnd = (input: HTMLInputElement): boolean =>
  input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

export const CommandsMode = ({
  query,
  onQueryChange,
  scope,
  onClearScope,
  onSwitchMode,
  onClose,
  modeSwitch,
}: PaletteModeProps) => {
  const env = useActionEnv({ origin: 'palette' });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const [frecency] = useState(readFrecency);
  const [now] = useState(() => Date.now());
  const [level, setLevel] = useState<Level | null>(null);
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState<PaletteEntry | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scopeInfo = useScopeInfo(scope);
  const scopeTarget: ObjectTarget | null =
    scope === null || scope.kind === 'workspace' ? null : scope;
  const scopeActions = useObjectActions({ target: scopeTarget, env });
  const levelActions = useObjectActions({ target: level?.target ?? null, env });
  const entries = useCommandEntries();

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

  const levelVerbs = useMemo(
    () =>
      level === null
        ? []
        : verbEntries({
            target: level.target,
            actions: levelActions.actions,
            isScope: false,
            noun: levelActions.noun ?? '',
            select: ({ action }: VerbSelectParams) =>
              runVerb({ target: level.target, actionId: action.id }),
          }),
    [level, levelActions.actions, levelActions.noun, runVerb],
  );

  const levelChoices = useMemo(
    () =>
      level === null || level.choicesOf === null
        ? []
        : choiceEntries({
            target: level.target,
            action: level.choicesOf,
            select: ({ choice }) => {
              void runObjectAction({
                target: level.target,
                actionId: level.choicesOf?.id ?? '',
                env,
                choice,
              });
            },
          }),
    [level, env],
  );

  const pool = useMemo(() => {
    const verbLabels = new Set(scopeVerbs.map((entry) => entry.label));
    const isSessionScope = scopeTarget?.kind === 'session';
    return entries.filter(
      (entry) =>
        !(entry.kind === 'action' && verbLabels.has(entry.label)) &&
        !(isSessionScope && REGISTRY_LENS_KEYS.has(entry.key)),
    );
  }, [entries, scopeVerbs, scopeTarget]);

  const sections = useMemo(
    () =>
      level === null
        ? buildCommandList({
            query,
            entries: pool,
            scopeVerbs,
            scopeTitle: scopeInfo === null ? null : `For this ${scopeInfo.noun}`,
            scopeKey: scopeInfo?.key ?? null,
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
    [level, query, pool, scopeVerbs, scopeInfo, frecency, now, filter, levelVerbs, levelChoices],
  );
  const rows = useMemo(() => flattenRows(sections), [sections]);
  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.item.key === selectedKey),
  );
  const selected: CommandRow | null = rows[selectedIndex] ?? null;
  const optionId = (key: string): string => `${listboxId}-${key}`;

  useEffect(() => {
    setSelectedKey(null);
  }, [query, filter, level]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [level, confirming]);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-key="${CSS.escape(selected.item.key)}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const subject = level?.title ?? scopeInfo?.title ?? null;

  const finish = (entry: PaletteEntry): void => {
    const at = Date.now();
    recordPaletteUse({ key: entry.key, now: at });
    if (level !== null) {
      recordPaletteUse({ key: level.key, now: at });
    }
    onClose();
    entry.run();
  };

  const activate = (entry: PaletteEntry): void => {
    if (entry.isBlocked === true) {
      return;
    }
    if (entry.action?.confirm != null) {
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
    if (entry.target === undefined || entry.kind === 'verb') {
      return;
    }
    setLevel({ target: entry.target, title: entry.label, key: entry.key, choicesOf: null });
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
    const altId = entry.action?.confirm?.altActionId;
    if (altId === undefined) {
      return null;
    }
    const verbs = level === null ? scopeVerbs : levelVerbs;
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
        if (confirming !== null) {
          finish(confirming);
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
      case 'ArrowRight':
        if (level !== null || selected === null || !isCaretAtEnd(event.currentTarget)) {
          return;
        }
        if (selected.item.target === undefined || selected.item.kind === 'verb') {
          return;
        }
        event.preventDefault();
        openActions(selected.item);
        return;
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
        : DEFAULT_PLACEHOLDER;
  const chip =
    level !== null ? (
      <ScopeChip icon={ChevronRight} label={level.title} hint="← or Backspace goes back" />
    ) : scopeInfo !== null ? (
      <ScopeChip icon={scopeInfo.icon} label={scopeInfo.title} hint="Backspace removes the scope" />
    ) : null;
  const alt = confirming === null ? null : altOf(confirming);

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
      {confirming !== null && confirming.action?.confirm != null ? (
        <VerbConfirm
          entry={confirming}
          confirm={confirming.action.confirm}
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
              className="flex flex-col gap-0.5 p-1.5"
            >
              {rows.length === 0 ? (
                <li role="presentation">
                  <EmptyState
                    icon={CONCEPT_ICONS.search}
                    tone={CONCEPT_TONE.search}
                    title={
                      (level === null ? query : filter).trim() === ''
                        ? 'Nothing to do here yet'
                        : `Nothing matches “${(level === null ? query : filter).trim()}”`
                    }
                    size="inline"
                    className="justify-center px-4 py-6"
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
