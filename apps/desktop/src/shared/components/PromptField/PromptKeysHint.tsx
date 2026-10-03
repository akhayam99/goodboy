import { shortcutGlyphs, type ShortcutId } from '../../keyboard/registry';

export type PromptKeyHint = {
  readonly id: ShortcutId;
  readonly label: string;
};

type Props = {
  readonly hints: ReadonlyArray<PromptKeyHint>;
};

export const PromptKeysHint = ({ hints }: Props) => {
  if (hints.length === 0) {
    return null;
  }
  return (
    <span
      data-testid="prompt-keys"
      className="hidden min-w-0 items-center gap-2.5 truncate text-secondary text-faint-foreground @lg/prompt:flex"
    >
      {hints.map((hint) => (
        <span key={hint.id} className="flex items-center gap-1 whitespace-nowrap">
          <kbd className="font-sans text-muted-foreground">{shortcutGlyphs(hint.id)}</kbd>
          {hint.label}
        </span>
      ))}
    </span>
  );
};
