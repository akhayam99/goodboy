import { useAppStore } from '../../../../../store';

type Params = {
  readonly message: string;
};

export const DEMO_NOTICE_TITLE = 'Demo playground';

export const showDemoNotice = ({ message }: Params): void => {
  useAppStore.setState((state) => ({
    undoNotices: [
      ...state.undoNotices,
      {
        id: crypto.randomUUID(),
        toast: {
          kind: 'info',
          title: DEMO_NOTICE_TITLE,
          message,
          dedupeKey: `demo-notice:${message}`,
        },
      },
    ],
  }));
};
