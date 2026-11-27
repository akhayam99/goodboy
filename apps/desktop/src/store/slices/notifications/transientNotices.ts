import type { Notification } from '@goodboy/db';

type ListenerParams = {
  readonly notification: Notification;
};

type Listener = (params: ListenerParams) => void;

const listeners = new Set<Listener>();

type SubscribeParams = {
  readonly listener: Listener;
};

export const subscribeTransientNotices = ({ listener }: SubscribeParams): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type PublishParams = {
  readonly notification: Notification;
};

export const publishTransientNotice = ({ notification }: PublishParams): void => {
  for (const listener of listeners) {
    listener({ notification });
  }
};
