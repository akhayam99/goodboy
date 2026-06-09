import { AlertTriangle } from 'lucide-react';

type Props = {
  readonly tail: string;
};

// Compact error surface: short header + last few lines of output (ANSI
// already stripped by runLifecycle). Kept lightweight, the full transcript
// stays in the inline terminal when the user expands again.
export const ErrorPanel = ({ tail }: Props) => {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-2 text-2xs text-danger">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={11} aria-hidden />
        <span>The command failed</span>
      </div>
      <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-foreground/80">
        {tail.trim() || 'No output captured.'}
      </pre>
    </div>
  );
};
