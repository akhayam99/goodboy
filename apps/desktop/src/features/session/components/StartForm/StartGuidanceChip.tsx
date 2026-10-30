import { Button, POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, useDropdown } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { guidanceWordsOf } from './guidanceWordsOf';
import type { StartGuidanceReader } from './startFormWords';

type PickParams = {
  readonly next: string | null;
};

type Props = {
  readonly value: string;
  readonly workspaceText: string;
  readonly workspaceName: string;
  readonly reader: StartGuidanceReader;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

const COPY = START_KIND_COPY.guidance;

export const StartGuidanceChip = ({
  value,
  workspaceText,
  workspaceName,
  reader,
  isDisabled,
  onPick,
}: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 320,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={COPY.label}
      title={COPY.title}
      words={guidanceWordsOf({ text: value, workspaceText, workspaceName })}
      help={COPY.readers[reader]}
      tooltip={value.trim()}
      error={null}
    >
      <PromptField
        kind="document"
        label={COPY.field}
        value={value}
        onChange={(next) => onPick({ next })}
        placeholder={COPY.placeholder}
        disabled={isDisabled}
        minRows={3}
        maxRows={8}
      />
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled || value.trim() === workspaceText.trim()}
          onClick={() => onPick({ next: null })}
        >
          {COPY.useWorkspace}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled || value.trim() === ''}
          onClick={() => onPick({ next: '' })}
        >
          {COPY.none}
        </Button>
      </div>
    </SettingChip>
  );
};
