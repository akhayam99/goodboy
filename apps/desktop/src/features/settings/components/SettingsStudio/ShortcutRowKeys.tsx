import { Button, KeyHint } from '@goodboy/ui';
import { shortcutRangeGlyphs } from '../../../../shared/keyboard/registry';
import { isRebindable } from '../../../../shared/keyboard/overrides/isRebindable';
import type { ShortcutRow } from './shortcutRows';
import type { ShortcutRecorder } from './useShortcutRecorder';

type Props = {
  readonly row: ShortcutRow;
  readonly isOverridden: boolean;
  readonly recorder: ShortcutRecorder;
};

export const ShortcutRowKeys = ({ row, isOverridden, recorder }: Props) => {
  const isSingle = row.first === row.last;
  const keys = <KeyHint keys={shortcutRangeGlyphs({ first: row.first, last: row.last })} />;

  if (isSingle && recorder.recordingId === row.first) {
    return (
      <input
        readOnly
        autoFocus
        aria-label={`New keys for ${row.label}`}
        placeholder="Press the new keys"
        onKeyDown={recorder.onKeyDown}
        onBlur={recorder.cancel}
        className="h-6 w-40 shrink-0 rounded-md bg-background px-2 text-meta text-foreground outline-none ring-1 ring-focus-ring placeholder:text-faint-foreground"
      />
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {isOverridden ? (
        <Button
          variant="quiet"
          size="xs"
          aria-label={`Reset keys for ${row.label}`}
          isBusy={recorder.isSaving}
          onClick={() => void recorder.reset({ id: row.first })}
        >
          Reset
        </Button>
      ) : null}
      {isSingle && isRebindable({ id: row.first }) ? (
        <Button
          variant="quiet"
          size="xs"
          aria-label={`Change keys for ${row.label}`}
          onClick={() => recorder.begin({ id: row.first })}
        >
          {keys}
        </Button>
      ) : (
        keys
      )}
    </span>
  );
};
