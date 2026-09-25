import { getVersion } from '@tauri-apps/api/app';
import type { SessionArtifact } from '@goodboy/types';
import { artifactMirrorFiles } from './artifactMirrorFiles';
import { artifactFolderName } from '../artifactFolderName';
import { pendingArtifactMirrors, writeArtifactMirror } from './artifactMirrorInvoke';

export type ArtifactMirrorItem = Readonly<{
  artifact: SessionArtifact;
  workspaceSlug: string;
}>;

const written = new Map<string, string>();

let tail: Promise<void> = Promise.resolve();

let version: Promise<string | null> | null = null;

const appVersion = (): Promise<string | null> => {
  version ??= getVersion().catch(() => null);
  return version;
};

export const artifactMirrorKey = ({ artifact }: { readonly artifact: SessionArtifact }): string =>
  `${artifact.revision}|${artifact.updatedAt}|${artifact.status}|${artifact.title}`;

export const markArtifactMirrored = ({
  artifact,
}: {
  readonly artifact: SessionArtifact;
}): void => {
  written.set(artifact.id, artifactMirrorKey({ artifact }));
};

const writeOne = async ({ artifact, workspaceSlug }: ArtifactMirrorItem): Promise<void> => {
  const key = artifactMirrorKey({ artifact });
  if (written.get(artifact.id) === key) {
    return;
  }
  const { folder, files } = artifactMirrorFiles({
    artifact,
    workspaceSlug,
    appVersion: await appVersion(),
  });
  try {
    await writeArtifactMirror({ workspaceSlug, folder, files });
    written.set(artifact.id, key);
  } catch {
    return;
  }
};

const staleItems = async ({
  items,
}: {
  readonly items: ReadonlyArray<ArtifactMirrorItem>;
}): Promise<ReadonlyArray<ArtifactMirrorItem>> => {
  const folders = items.map(({ artifact }) => artifactFolderName({ artifact }));
  try {
    const pending = new Set(
      await pendingArtifactMirrors({
        entries: items.map(({ artifact, workspaceSlug }, index) => ({
          workspaceSlug,
          folder: folders[index] ?? '',
          revision: artifact.revision,
          updatedAt: artifact.updatedAt,
        })),
      }),
    );
    return items.filter((item, index) => {
      if (pending.has(folders[index] ?? '')) {
        return true;
      }
      markArtifactMirrored({ artifact: item.artifact });
      return false;
    });
  } catch {
    return items;
  }
};

export const mirrorArtifacts = ({
  items,
}: {
  readonly items: ReadonlyArray<ArtifactMirrorItem>;
}): Promise<void> => {
  const pending = items.filter(
    ({ artifact }) => written.get(artifact.id) !== artifactMirrorKey({ artifact }),
  );
  if (pending.length === 0) {
    return tail;
  }
  tail = tail.then(async () => {
    const stale = await staleItems({ items: pending });
    for (const item of stale) {
      await writeOne(item);
    }
  });
  return tail;
};

export const resetArtifactMirrorQueue = (): void => {
  written.clear();
  tail = Promise.resolve();
  version = null;
};
