import { useShallow } from 'zustand/react/shallow';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectLapProject } from '../../../store/slices/bootstrap/firstLap';

type Params = {
  readonly sessionId: SessionId;
};

export type LapProjectView = {
  readonly project: Project | null;
  readonly stage: 'first-lap' | 'moving' | null;
};

const NO_LAP: LapProjectView = { project: null, stage: null };

export const useLapProject = ({ sessionId }: Params): LapProjectView =>
  useAppStore(useShallow((state) => selectLapProject({ state, sessionId }) ?? NO_LAP));
