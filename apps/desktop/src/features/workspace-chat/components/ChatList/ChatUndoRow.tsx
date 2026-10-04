type Props = {
  readonly label: string;
  readonly onUndo: () => void;
};

export const ChatUndoRow = ({ label, onUndo }: Props) => (
  <div role="status" className="flex items-center gap-2 px-2 py-1 text-meta text-faint-foreground">
    <span className="min-w-0 truncate">{label}</span>
    <button
      type="button"
      onClick={onUndo}
      className="shrink-0 rounded-sm px-1 text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      Undo
    </button>
  </div>
);
