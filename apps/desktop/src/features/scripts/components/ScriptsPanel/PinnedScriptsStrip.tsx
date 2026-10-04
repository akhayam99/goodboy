import { Pin, Play } from 'lucide-react';
import { Band, Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type PinnedScriptEntry = {
  readonly key: string;
  readonly name: string;
  readonly projectName: string;
  readonly isRunning: boolean;
  readonly blockedReason: string | null;
  readonly onRun: () => void;
};

type Props = {
  readonly entries: ReadonlyArray<PinnedScriptEntry>;
};

export const PinnedScriptsStrip = ({ entries }: Props) => (
  <section aria-label="Pinned scripts">
    <Band inset="content">
      <span className="flex items-center gap-2 text-eyebrow text-muted-foreground">
        <Pin size={ICON_SIZE.control} aria-hidden className="text-primary" />
        Pinned
        <span className="tabular-nums text-faint-foreground">{entries.length}</span>
      </span>
      {entries.length === 0 ? (
        <p className="text-meta text-faint-foreground">
          Pin a script with the pin icon. Pinned scripts show here and in the palette under $.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <Button
              key={entry.key}
              variant="secondary"
              size="sm"
              aria-label={`Run ${entry.name} in ${entry.projectName}`}
              disabled={entry.isRunning || entry.blockedReason !== null}
              onClick={entry.onRun}
            >
              <Play size={ICON_SIZE.control} aria-hidden />
              <span className="font-mono">{entry.name}</span>
              <span className="text-faint-foreground">{entry.projectName}</span>
            </Button>
          ))}
        </div>
      )}
    </Band>
  </section>
);
