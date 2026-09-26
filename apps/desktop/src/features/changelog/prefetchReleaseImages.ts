import { invoke } from '@tauri-apps/api/core';
import { changelogImageFilesForFeature } from './changelogImageFiles';
import type { ReleaseEntry } from './parseChangelog';

type ReleaseImageRequest = {
  readonly version: string;
  readonly file: string;
};

export const releaseImageRequests = ({
  release,
}: {
  readonly release: ReleaseEntry;
}): ReadonlyArray<ReleaseImageRequest> => {
  if (release.shape !== 'v2') {
    return [];
  }
  const newFiles = release.sections.new.flatMap((feature) =>
    changelogImageFilesForFeature({ feature, hasBefore: false }),
  );
  const improvedFiles = release.sections.improved.flatMap((feature) =>
    changelogImageFilesForFeature({ feature, hasBefore: true }),
  );
  return [...newFiles, ...improvedFiles].map((file) => ({ version: release.version, file }));
};

export const prefetchReleaseImages = ({ release }: { readonly release: ReleaseEntry }): void => {
  releaseImageRequests({ release }).forEach((request) => {
    void invoke('changelog_image', request).catch(() => undefined);
  });
};
