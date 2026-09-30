import type { Session } from '@goodboy/types';
import { findById } from '../../../shared/utils/findById';

export const sessionById = <T extends Pick<Session, 'id'>>(
  sessions: ReadonlyArray<T>,
  id: string | null | undefined,
): T | undefined => findById(sessions, id);
