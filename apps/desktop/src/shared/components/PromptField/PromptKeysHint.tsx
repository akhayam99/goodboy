import { KeyHint, cn } from '@goodboy/ui';
import { shortcutGlyphs, type ShortcutId } from '../../keyboard/registry';

export type PromptKeyHint = {
  readonly id: ShortcutId;
  readonly label: string;
};

type Props = {
  readonly id: string;
  readonly hints: ReadonlyArray<PromptKeyHint>;
  readonly isShown: boolean;
};

export const PromptKeysHint = ({ id, hints, isShown }: Props) => {
  if (hints.length === 0) {
    return null;
  }
  return (
    <span
      id={id}
      data-testid="prompt-keys"
      data-shown={isShown}
      className={cn(
        'hidden',
        isShown &&
          'min-w-0 items-center gap-3 truncate text-meta text-faint-foreground @lg/prompt:flex',
      )}
    >
      {hints.map((hint) => (
        <span key={hint.id} className="flex items-center gap-1 whitespace-nowrap">
          <KeyHint keys={shortcutGlyphs(hint.id)} />
          {hint.label}
        </span>
      ))}
    </span>
  );
};
