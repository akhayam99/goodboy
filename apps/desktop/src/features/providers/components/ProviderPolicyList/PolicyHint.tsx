import { Check } from 'lucide-react';
import { ICON_SIZE, KbdPill } from '@goodboy/ui';

type Props = {
  readonly dragNote: string | null;
  readonly saved: string | null;
};

export const PolicyHint = ({ dragNote, saved }: Props) => {
  if (dragNote !== null) {
    return <p className="min-w-0 flex-1 text-secondary text-foreground">{dragNote}</p>;
  }
  if (saved !== null) {
    return (
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-secondary text-muted-foreground">
        <Check size={ICON_SIZE.row} aria-hidden className="text-success" />
        <span className="text-success">Saved</span>
        <span>{saved}</span>
      </p>
    );
  }
  return (
    <p className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-secondary text-faint-foreground">
      <span>Drag the handle, or</span>
      <KbdPill>Alt</KbdPill>
      <KbdPill>↑</KbdPill>
      <KbdPill>↓</KbdPill>
      <span>to reorder. First On is the default.</span>
    </p>
  );
};
