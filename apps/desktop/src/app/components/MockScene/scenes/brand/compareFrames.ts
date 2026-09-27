import { useEffect } from 'react';
import type { ArtifactFolderFile } from '../../../../../features/artifacts/artifactFile';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';

type Staged = ReadonlyArray<ArtifactFolderFile>;

const stages = new Map<string, Staged>();

const isFileList = (value: unknown): value is Staged =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).path === 'string' &&
      typeof (entry as Record<string, unknown>).contents === 'string',
  );

const HANDLERS: FakeHandlers = {
  frame_stage: (args) => {
    const files = args?.files;
    if (!isFileList(files)) {
      throw new Error('frame_stage needs files');
    }
    const stageId = `brand-stage-${stages.size + 1}`;
    stages.set(stageId, files);
    return stageId;
  },
  frame_release: () => true,
};

type ResolveParams = Readonly<{ from: string; href: string }>;

const resolvePath = ({ from, href }: ResolveParams): string => {
  const parts = from.split('/').slice(0, -1);
  for (const segment of href.split('/')) {
    if (segment === '..') {
      parts.pop();
      continue;
    }
    if (segment !== '.' && segment !== '') {
      parts.push(segment);
    }
  }
  return parts.join('/');
};

type InlineParams = Readonly<{ files: Staged; path: string }>;

const inlinePage = ({ files, path }: InlineParams): string | null => {
  const page = files.find((file) => file.path === path);
  if (page === undefined) {
    return null;
  }
  const withStyles = page.contents.replace(
    /<link rel="stylesheet" href="([^"]+)">/g,
    (match, href: string) => {
      const target = resolvePath({ from: path, href });
      const sheet = files.find((file) => file.path === target);
      return sheet === undefined ? match : `<style>${sheet.contents}</style>`;
    },
  );
  return withStyles.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
};

const FRAME_PATTERN = /^(?:gbframe:\/\/localhost|http:\/\/gbframe\.localhost)\/([^/]+)\/(.+)$/;

const patchFrames = (): void => {
  document
    .querySelectorAll<HTMLIFrameElement>('iframe[data-testid="wireframe-frame"]')
    .forEach((frame) => {
      const match = FRAME_PATTERN.exec(frame.getAttribute('src') ?? '');
      const stageId = match?.[1];
      const path = match?.[2];
      if (stageId === undefined || path === undefined) {
        return;
      }
      const key = `${stageId}/${path}`;
      if (frame.dataset.brandStage === key) {
        return;
      }
      const files = stages.get(stageId);
      const html = files === undefined ? null : inlinePage({ files, path });
      if (html === null) {
        return;
      }
      frame.dataset.brandStage = key;
      frame.srcdoc = html;
    });
};

export const useCompareFrames = (): void => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 400 });

  useEffect(() => {
    const interval = window.setInterval(patchFrames, 150);
    return () => window.clearInterval(interval);
  }, []);
};
