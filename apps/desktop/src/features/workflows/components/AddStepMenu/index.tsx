import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { AnchoredPopover, Input, KbdPill, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ROLE_LABEL, kindForRole } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { savedStepNote, type SavedStep, type SavedStepGroups } from '../../savedSteps';
import { AddStepMenuOption } from './AddStepMenuOption';

type Props = {
  readonly groups: SavedStepGroups;
  readonly disabled: boolean;
  readonly onPick: (step: SavedStep | null) => void;
};

const PANEL_WIDTH = 384;

type MatchParams = {
  readonly step: SavedStep;
  readonly needle: string;
};

const matches = ({ step, needle }: MatchParams): boolean =>
  needle === '' ||
  step.name.toLowerCase().includes(needle) ||
  ROLE_LABEL[step.role].toLowerCase().includes(needle) ||
  step.promptPrefix.toLowerCase().includes(needle);

export const AddStepMenu = ({ groups, disabled, onPick }: Props) => {
  const dropdown = useDropdown({
    disabled,
    expectedHeight: 360,
    expectedWidth: PANEL_WIDTH,
    width: 'w-[24rem] max-w-[calc(100vw-2rem)]',
  });
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const blankId = `${listId}-blank`;
  const optionId = (step: SavedStep): string => `${listId}-${step.id}`;
  const needle = query.trim().toLowerCase();
  const builtin = groups.builtin.filter((step) => matches({ step, needle }));
  const workspace = groups.workspace.filter((step) => matches({ step, needle }));
  const options: ReadonlyArray<SavedStep | null> = [null, ...builtin, ...workspace];
  const active = Math.min(activeIndex, options.length - 1);

  useEffect(() => {
    if (!dropdown.open) {
      return;
    }
    inputRef.current?.focus();
  }, [dropdown.open]);

  const pick = (step: SavedStep | null) => {
    dropdown.close();
    onPick(step);
  };

  const onToggle = () => {
    if (!dropdown.open) {
      setQuery('');
      setActiveIndex(0);
    }
    dropdown.toggle();
  };

  const onQuery = (next: string) => {
    setQuery(next);
    const hasMatch =
      next.trim() !== '' &&
      [...groups.builtin, ...groups.workspace].some((step) =>
        matches({ step, needle: next.trim().toLowerCase() }),
      );
    setActiveIndex(hasMatch ? 1 : 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((active + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((active - 1 + options.length) % options.length);
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const choice = options[active];
    if (choice === undefined) {
      return;
    }
    pick(choice);
  };

  const activeId = (() => {
    const choice = options[active];
    return choice === undefined || choice === null ? blankId : optionId(choice);
  })();

  const renderStep = (step: SavedStep, index: number) => (
    <AddStepMenuOption
      key={step.id}
      id={optionId(step)}
      isActive={active === index}
      lead={<AgentKindChip kind={kindForRole({ role: step.role })} label={ROLE_LABEL[step.role]} />}
      name={step.name}
      note={savedStepNote({ step, groups })}
      onHover={() => setActiveIndex(index)}
      onPick={() => pick(step)}
    />
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Add a step"
      anchorClassName="flex min-w-0 flex-1"
      className="flex max-h-[min(28rem,70vh)] flex-col bg-elevated"
      trigger={
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          className="flex h-8 min-w-0 flex-1 items-center rounded-md pl-2 text-left text-label text-faint-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add step
        </button>
      }
    >
      <label className="relative flex shrink-0 items-center p-1.5">
        <span className="sr-only">Search steps</span>
        <Search
          size={ICON_SIZE.row}
          aria-hidden
          className="pointer-events-none absolute left-3.5 text-faint-foreground"
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search steps"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeId}
          className="h-7 pl-7 text-label"
        />
      </label>
      <ul
        id={listId}
        role="listbox"
        aria-label="Steps"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-1.5"
      >
        <AddStepMenuOption
          id={blankId}
          isActive={active === 0}
          lead={<Plus size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />}
          name="Blank step"
          note=""
          trail={active === 0 ? <KbdPill>Enter</KbdPill> : null}
          onHover={() => setActiveIndex(0)}
          onPick={() => pick(null)}
        />
        {builtin.length > 0 ? (
          <li
            role="presentation"
            className="px-2 pb-0.5 pt-2 text-meta font-semibold uppercase tracking-eyebrow text-faint-foreground"
          >
            Built in
          </li>
        ) : null}
        {builtin.map((step, index) => renderStep(step, index + 1))}
        {workspace.length > 0 ? (
          <li
            role="presentation"
            className="px-2 pb-0.5 pt-2 text-meta font-semibold uppercase tracking-eyebrow text-faint-foreground"
          >
            This workspace
          </li>
        ) : null}
        {workspace.map((step, index) => renderStep(step, index + 1 + builtin.length))}
        {needle !== '' && builtin.length === 0 && workspace.length === 0 ? (
          <li role="presentation" className="px-2 py-1.5 text-secondary text-muted-foreground">
            No saved steps match that search
          </li>
        ) : null}
      </ul>
    </AnchoredPopover>
  );
};
