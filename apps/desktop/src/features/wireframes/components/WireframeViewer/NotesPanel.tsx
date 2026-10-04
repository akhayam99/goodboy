import { X } from 'lucide-react';
import { EmptyLine, Eyebrow, IconButton, SelectableRow, WorkNode } from '@goodboy/ui';
import type { WireframeNodeNote, WireframeScreenLink } from '../../wireframeNotes';

type Props = {
  readonly screenNote: string | null;
  readonly notes: ReadonlyArray<WireframeNodeNote>;
  readonly links: ReadonlyArray<WireframeScreenLink>;
  readonly onReveal: (nodeId: string) => void;
  readonly onOpenScreen: (screenId: string) => void;
  readonly onClose: () => void;
};

export const NotesPanel = ({
  screenNote,
  notes,
  links,
  onReveal,
  onOpenScreen,
  onClose,
}: Props) => (
  <aside aria-label="Notes" data-testid="wireframe-notes" className="flex min-w-0 flex-col gap-3">
    <div className="flex items-center justify-between gap-2">
      <h3>
        <Eyebrow label="Notes" />
      </h3>
      <IconButton icon={X} label="Hide notes" variant="ghost" onClick={onClose} />
    </div>
    {screenNote === null ? null : <p className="text-body text-foreground">{screenNote}</p>}
    {notes.length === 0 && screenNote === null ? (
      <EmptyLine>No notes on this screen.</EmptyLine>
    ) : null}
    {notes.length === 0 ? null : (
      <ol className="flex min-w-0 flex-col gap-1">
        {notes.map((note) => (
          <li key={note.nodeId}>
            <SelectableRow
              selected={false}
              onClick={() => onReveal(note.nodeId)}
              title={`Show ${note.label} on the page`}
              className="items-start gap-2 px-2 py-1"
            >
              <WorkNode
                state="marker"
                mark={{ kind: 'index', value: String(note.number) }}
                label={`Note ${note.number}`}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-meta text-muted-foreground">{note.label}</span>
                <span className="text-body text-foreground">{note.note}</span>
              </span>
            </SelectableRow>
          </li>
        ))}
      </ol>
    )}
    {links.length === 0 ? null : (
      <section aria-label="Goes to" className="flex min-w-0 flex-col gap-1">
        <h4>
          <Eyebrow label="Goes to" />
        </h4>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {links.map((link) => (
            <li key={`${link.nodeId}-${link.toScreenId}`}>
              <SelectableRow
                selected={false}
                onClick={() => onOpenScreen(link.toScreenId)}
                className="items-center gap-2 px-2 py-1"
              >
                <WorkNode
                  state="queued"
                  mark={{ kind: 'index', value: String(link.toNumber) }}
                  label={`Screen ${link.toNumber}`}
                />
                <span className="min-w-0 flex-1 truncate text-body">{link.toTitle}</span>
                <span className="shrink-0 truncate text-meta text-muted-foreground">
                  {link.label}
                </span>
              </SelectableRow>
            </li>
          ))}
        </ul>
      </section>
    )}
  </aside>
);
