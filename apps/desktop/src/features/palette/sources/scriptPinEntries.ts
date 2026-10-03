import type { Project, ProjectId, ProjectScript } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

export type PinnedScriptTarget = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly pinId: string;
  readonly name: string;
};

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly pins: Readonly<Record<ProjectId, ReadonlyArray<string>>>;
  readonly saved: ReadonlyArray<ProjectScript>;
  readonly run: (target: PinnedScriptTarget) => void;
};

const nameOfPin = ({
  pinId,
  saved,
}: {
  readonly pinId: string;
  readonly saved: ReadonlyArray<ProjectScript>;
}): string | null => {
  try {
    const parsed: unknown = JSON.parse(pinId);
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      return null;
    }
    const [source, , name] = parsed as ReadonlyArray<unknown>;
    if (typeof name !== 'string') {
      return null;
    }
    if (source !== 'saved') {
      return name;
    }
    return saved.find((script) => script.id === name)?.name ?? null;
  } catch {
    return null;
  }
};

export const scriptPinEntries = ({
  projects,
  pins,
  saved,
  run,
}: Params): ReadonlyArray<PaletteEntry> =>
  projects.flatMap((project) =>
    (pins[project.id] ?? []).flatMap((pinId): ReadonlyArray<PaletteEntry> => {
      const name = nameOfPin({ pinId, saved });
      if (name === null) {
        return [];
      }
      const target: PinnedScriptTarget = {
        projectId: project.id,
        projectName: project.name,
        pinId,
        name,
      };
      return [
        {
          key: `script-pin:${project.id}:${pinId}`,
          label: name,
          kind: 'script',
          group: 'script',
          icon: CONCEPT_ICONS.scripts,
          detail: project.name,
          tag: 'Pinned',
          run: () => run(target),
        },
      ];
    }),
  );
