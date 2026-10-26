import { create } from 'zustand';

type AnnouncementState = {
  readonly message: string;
  readonly sequence: number;
};

export const useAnnouncementStore = create<AnnouncementState>(() => ({
  message: '',
  sequence: 0,
}));

type AnnounceParams = {
  readonly message: string;
};

export const announce = ({ message }: AnnounceParams): void => {
  useAnnouncementStore.setState((state) => ({ message, sequence: state.sequence + 1 }));
};
