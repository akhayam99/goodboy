import { useCallback } from 'react';
import { openDestination } from '../../../shared/navigation/openDestination';

export const useGoToBoard = (): (() => void) =>
  useCallback(() => openDestination({ id: 'board' }), []);
