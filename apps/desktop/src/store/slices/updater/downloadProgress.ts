import type { DownloadEvent } from '@tauri-apps/plugin-updater';

type Progress = {
  readonly downloaded: number;
  readonly total: number | null;
};

type Params = {
  readonly event: DownloadEvent;
  readonly current: Progress;
};

export const progressFrom = ({ event, current }: Params): Progress => {
  switch (event.event) {
    case 'Started':
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case 'Progress':
      return { ...current, downloaded: current.downloaded + event.data.chunkLength };
    case 'Finished':
      return { ...current, downloaded: current.total ?? current.downloaded };
    default: {
      const _exhaustive: never = event;
      return current;
    }
  }
};
