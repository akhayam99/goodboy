interface Props {
  readonly command: string;
}

// Reassures power users by showing exactly what shell command runs. Mirrors
// the conventional `$ ` prompt prefix so it reads as runnable text.
export function CommandPreview({ command }: Props) {
  return (
    <div className="overflow-x-auto rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">
      <span aria-hidden className="text-muted-foreground/50">
        ${' '}
      </span>
      <span className="text-foreground">{command}</span>
    </div>
  );
}
