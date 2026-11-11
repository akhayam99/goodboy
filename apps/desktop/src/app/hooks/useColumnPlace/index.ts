import { useAppStore } from '../../../store';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';
import { selectColumnPlace } from '../../../shared/navigation/selectColumnPlace';

export const useColumnPlace = (): ColumnPlace =>
  useAppStore((state) => selectColumnPlace({ state }));
