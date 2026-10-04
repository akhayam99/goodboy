import { RotateCcw, SlidersHorizontal, Undo2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly differs: boolean;
  readonly isRuleEmpty: boolean;
  readonly canUndo: boolean;
  readonly canPolish: boolean;
  readonly isPolishing: boolean;
  readonly disabled: boolean;
  readonly onReset: () => void;
  readonly onSaveDefault: () => void;
  readonly onUndo: () => void;
  readonly onPolish: () => void;
};

const TOOL_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-chip text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const GuidanceTools = ({
  differs,
  isRuleEmpty,
  canUndo,
  canPolish,
  isPolishing,
  disabled,
  onReset,
  onSaveDefault,
  onUndo,
  onPolish,
}: Props) => (
  <div data-testid="guidance-tools" className="flex min-w-0 flex-wrap items-center gap-1">
    {differs ? (
      <>
        <span className="text-meta text-faint-foreground">Edited for this run</span>
        <button type="button" className={TOOL_CLASS} disabled={disabled} onClick={onReset}>
          <RotateCcw size={ICON_SIZE.row} aria-hidden /> Reset
        </button>
        <button type="button" className={TOOL_CLASS} disabled={disabled} onClick={onSaveDefault}>
          Save as default
        </button>
      </>
    ) : (
      <span className="inline-flex items-center gap-1 text-meta text-faint-foreground">
        <SlidersHorizontal size={ICON_SIZE.row} aria-hidden />
        {isRuleEmpty ? 'Nothing in your rules yet' : 'From your rules'}
      </span>
    )}
    <span className="flex-1" />
    {canUndo ? (
      <button
        type="button"
        className={TOOL_CLASS}
        aria-label="Undo guidance change"
        disabled={disabled}
        onClick={onUndo}
      >
        <Undo2 size={ICON_SIZE.row} aria-hidden /> Undo
      </button>
    ) : null}
    <button
      type="button"
      className={TOOL_CLASS}
      aria-label="Polish guidance"
      disabled={disabled || isPolishing || !canPolish}
      onClick={onPolish}
    >
      <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
      <span className={cn(isPolishing && 'text-shimmer')}>Polish</span>
    </button>
  </div>
);
