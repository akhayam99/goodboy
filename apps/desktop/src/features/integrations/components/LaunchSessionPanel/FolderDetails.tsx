import { FieldRow, Input, SectionHeader } from '@goodboy/ui';
import { Folder } from 'lucide-react';

type Props = {
  readonly folderName: string;
  readonly onFolderNameChange: (next: string) => void;
  readonly pathPreview: string | null;
  readonly nameError: string | null;
  readonly exists: boolean;
  readonly isChecking: boolean;
  readonly busy: boolean;
};

export const FolderDetails = ({
  folderName,
  onFolderNameChange,
  pathPreview,
  nameError,
  exists,
  isChecking,
  busy,
}: Props) => {
  return (
    <section className="flex flex-col">
      <SectionHeader
        icon={<Folder size={12} aria-hidden />}
        label="Folder"
        hint="This is the folder name you will find on disk inside your workspace folder."
      />
      <FieldRow
        label="Folder name"
        help="The app creates this folder in your workspace under sessions"
        layout="stacked"
      >
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex w-full items-center gap-1.5">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">sessions/</span>
            <Input
              value={folderName}
              onChange={(event) => onFolderNameChange(event.target.value)}
              placeholder="session"
              className="h-8 min-w-0 flex-1 text-sm"
              disabled={busy}
              aria-label="Folder name"
            />
          </div>
          {pathPreview != null ? (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Folder on disk:{' '}
              <span className="break-all font-mono text-muted-foreground">{pathPreview}</span>
            </p>
          ) : null}
          {nameError != null ? (
            <p role="alert" className="text-2xs leading-relaxed text-danger">
              {nameError}
            </p>
          ) : null}
          {nameError == null && exists ? (
            <p role="alert" className="text-2xs leading-relaxed text-danger">
              A folder with this name already exists in this workspace
            </p>
          ) : null}
          {nameError == null && !exists && isChecking ? (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Checking if this folder already exists
            </p>
          ) : null}
        </div>
      </FieldRow>
    </section>
  );
};
