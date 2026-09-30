import type { Session } from '@goodboy/types';
import { findById } from '../../../shared/utils/findById';

export const sessionById = <T extends Pick<Session, 'id'>>(
  sessions: ReadonlyArray<T> | null | undefined,
  id: string | null | undefined,
): T | undefined => findById(sessions, id);
