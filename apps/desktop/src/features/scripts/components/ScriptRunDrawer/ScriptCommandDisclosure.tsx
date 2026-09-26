import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Reveal, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly command: string;
};

export const ScriptCommandDisclosure = ({ command }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const lineCount = command.trim().split('\n').length;

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-1 self-start rounded-sm text-secondary text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        <span>Command</span>
        <span className="text-faint-foreground">
          · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
      </button>
      <Reveal open={isOpen} id={panelId}>
        <pre className="whitespace-pre-wrap break-all rounded-md bg-subtle px-3 py-2 font-mono text-2xs leading-relaxed text-foreground">
          {command}
        </pre>
      </Reveal>
    </div>
  );
};
