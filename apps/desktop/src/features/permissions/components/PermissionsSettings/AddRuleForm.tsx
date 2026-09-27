import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, SegmentedTabs } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { NewRule } from '../../hooks/usePermissionRules';

type Props = {
  readonly onAdd: (rule: NewRule) => Promise<boolean>;
};

type Decision = NewRule['decision'];
type Where = NewRule['where'];

type Suggestion = {
  readonly command: string;
  readonly decision: Decision;
};

const SUGGESTIONS: ReadonlyArray<Suggestion> = [
  { command: 'git status', decision: 'allow' },
  { command: 'pnpm test', decision: 'allow' },
  { command: 'git push', decision: 'deny' },
];

const DECISIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
] as const satisfies ReadonlyArray<{ readonly value: Decision; readonly label: string }>;

const WHERE = [
  { value: 'workspace', label: 'This workspace' },
  { value: 'global', label: 'All workspaces' },
] as const satisfies ReadonlyArray<{ readonly value: Where; readonly label: string }>;

export const AddRuleForm = ({ onAdd }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [decision, setDecision] = useState<Decision>('allow');
  const [command, setCommand] = useState('');
  const [where, setWhere] = useState<Where>('workspace');
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = command.trim();

  const reset = () => {
    setIsOpen(false);
    setDecision('allow');
    setCommand('');
    setWhere('workspace');
  };

  const submit = async () => {
    if (trimmed === '') {
      return;
    }
    setIsSaving(true);
    const isAdded = await onAdd({ decision, command: trimmed, where });
    setIsSaving(false);
    if (isAdded) {
      reset();
    }
  };

  if (!isOpen) {
    return (
      <div>
        <Button size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          Add rule
        </Button>
      </div>
    );
  }

  return (
    <form
      aria-label="Add rule"
      className="flex flex-col gap-3 rounded-lg bg-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs
          size="sm"
          ariaLabel="Decision"
          options={DECISIONS}
          value={decision}
          onChange={setDecision}
        />
        <Input
          aria-label="Commands starting with"
          placeholder="pnpm test"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          className="min-w-40 flex-1 font-mono"
        />
        <SegmentedTabs
          size="sm"
          ariaLabel="Where"
          options={WHERE}
          value={where}
          onChange={setWhere}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-secondary text-muted-foreground">Try</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.command}
            type="button"
            onClick={() => {
              setCommand(suggestion.command);
              setDecision(suggestion.decision);
            }}
            className="rounded-md px-1.5 py-0.5 font-mono text-secondary text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            {suggestion.command}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={trimmed === ''} isBusy={isSaving}>
            Add rule
          </Button>
        </div>
      </div>
    </form>
  );
};
