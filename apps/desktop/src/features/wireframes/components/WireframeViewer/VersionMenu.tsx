import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Button, Eyebrow, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { wireframeVersionLabel, type WireframeVersion } from '../../wireframeVersion';
import { VersionRow } from './VersionRow';

type Props = {
  readonly versions: ReadonlyArray<WireframeVersion>;
  readonly currentRevision: number;
  readonly viewingRevision: number;
  readonly drafting: Readonly<{ revision: number; ask: string }> | null;
  readonly agentName: string;
  readonly onView: (revision: number) => void;
  readonly onCompare: (revision: number) => void;
  readonly onRestore: (revision: number) => void;
};

export const VersionMenu = ({
  versions,
  currentRevision,
  viewingRevision,
  drafting,
  agentName,
  onView,
  onCompare,
  onRestore,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    expectedHeight: 320,
    expectedWidth: 384,
  });
  const label =
    drafting === null
      ? viewingRevision === currentRevision
        ? `v${currentRevision}`
        : `v${viewingRevision} of ${currentRevision}`
      : `v${drafting.revision} · Drafting`;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Versions"
      className="flex flex-col gap-2 p-2"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          data-testid="wireframe-version-pill"
        >
          {label}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </Button>
      }
    >
      <h3 className="px-1.5">
        <Eyebrow label={`Versions · ${versions.length}`} />
      </h3>
      <ol className="flex min-w-0 flex-col gap-0.5">
        {drafting === null ? null : (
          <li
            data-testid="wireframe-version-drafting"
            className="flex min-w-0 flex-col px-1.5 py-1 text-body"
          >
            <span className="truncate">
              v{drafting.revision} {drafting.ask}
            </span>
            <span className="text-secondary text-muted-foreground">Drafting</span>
          </li>
        )}
        {versions.map((version) => (
          <VersionRow
            key={version.revision}
            version={version}
            label={wireframeVersionLabel({ version })}
            agentName={agentName}
            isCurrent={version.revision === currentRevision}
            isViewing={version.revision === viewingRevision}
            onView={() => {
              onView(version.revision);
              dropdown.close();
            }}
            onCompare={() => {
              onCompare(version.revision);
              dropdown.close();
            }}
            onRestore={() => {
              onRestore(version.revision);
              dropdown.close();
            }}
          />
        ))}
      </ol>
    </AnchoredPopover>
  );
};
