import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  Input,
  Listbox,
  useDropdown,
  type ButtonVariant,
} from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { isValidPort } from '../../../../store/slices/monitoring/isValidPort';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly defaultProjectId: string | null;
  readonly variant: ButtonVariant;
};

export const WatchPortPopover = ({ projects, defaultProjectId, variant }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const watchPort = useAppStore((state) => state.watchPort);
  const [portText, setPortText] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const chosenId = projectId ?? defaultProjectId ?? projects[0]?.id ?? null;
  const port = Number(portText);
  const isPortValid = portText.trim() !== '' && isValidPort({ port });
  const hasError = portText.trim() !== '' && !isPortValid;
  const project = projectById(projects, chosenId);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isPortValid || project === undefined) {
      return;
    }
    await watchPort({ projectId: project.id, port });
    const isWatched = useAppStore.getState().monitorWatched[project.id]?.includes(port) === true;
    if (!isWatched) {
      return;
    }
    setPortText('');
    dropdown.close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Watch a port"
      hasBackdrop
      className="p-3"
      trigger={
        <Button size="sm" variant={variant} onClick={dropdown.toggle} aria-expanded={dropdown.open}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          Watch a port
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="watch-port-number" className="text-label text-foreground">
            Port
          </label>
          <Input
            id="watch-port-number"
            inputMode="numeric"
            placeholder="5005"
            value={portText}
            aria-invalid={hasError}
            onChange={(event) => setPortText(event.target.value)}
            autoFocus
          />
          {hasError ? (
            <span role="alert" className="text-meta text-danger">
              Use a number from 1 to 65535
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label text-foreground">Project</span>
          <Listbox
            ariaLabel="Project"
            value={chosenId}
            options={projects.map((item) => ({ value: item.id, label: item.name }))}
            onChange={setProjectId}
            isBlock
          />
        </div>
        <Button type="submit" size="sm" disabled={!isPortValid || project === undefined}>
          Watch
        </Button>
      </form>
    </AnchoredPopover>
  );
};
