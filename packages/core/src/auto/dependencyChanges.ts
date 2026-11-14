import { dependencyGrantsOf } from './dependencyGrant';
import { isLockfileChangeCovered } from './isLockfileChangeCovered';
import { isManifestChangeCovered } from './isManifestChangeCovered';
import { PACKAGE_MANAGERS } from './launchGuard';
import { pathsOfPatch } from './patchPaths';

const HEADER = 'diff --git ';
const MANIFESTS: ReadonlyArray<string> = PACKAGE_MANAGERS.flatMap((manager) => manager.manifests);
const LOCKFILES: ReadonlyArray<string> = PACKAGE_MANAGERS.flatMap((manager) => manager.lockfiles);

type TextParams = { readonly text: string };

const baseNameOf = ({ text }: TextParams): string => text.slice(text.lastIndexOf('/') + 1);

type SectionsParams = { readonly patch: string };

const sectionsOf = ({ patch }: SectionsParams): ReadonlyMap<string, ReadonlyArray<string>> => {
  const sections = new Map<string, ReadonlyArray<string>>();
  const chunks = patch
    .split(`\n${HEADER}`)
    .map((chunk, index) => (index === 0 ? chunk : `${HEADER}${chunk}`));
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    for (const path of pathsOfPatch({ patch: chunk })) {
      sections.set(path, lines);
    }
  }
  return sections;
};

type Params = {
  readonly paths: ReadonlyArray<string>;
  readonly patch: string | null;
  readonly allowedPackages: ReadonlyArray<string>;
};

export const unattributedDependencyPathsOf = ({
  paths,
  patch,
  allowedPackages,
}: Params): ReadonlyArray<string> => {
  const manifests = paths.filter((path) => MANIFESTS.includes(baseNameOf({ text: path })));
  const lockfiles = paths.filter((path) => LOCKFILES.includes(baseNameOf({ text: path })));
  if (patch === null || allowedPackages.length === 0) {
    return [...manifests, ...lockfiles];
  }
  const sections = sectionsOf({ patch });
  const grants = dependencyGrantsOf({ allowedPackages });
  return [
    ...manifests.filter((path) => {
      const lines = sections.get(path);
      return lines === undefined || !isManifestChangeCovered({ lines, grants });
    }),
    ...lockfiles.filter((path) => {
      const lines = sections.get(path);
      return lines === undefined || !isLockfileChangeCovered({ path, lines, grants });
    }),
  ];
};
