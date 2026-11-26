import { useContext } from 'react';
import { PortColumnsContext } from '../PortColumnsContext';
import type { PortColumns } from '../portColumns';

type Params = Record<never, never>;

export const usePortColumns = ({}: Params): PortColumns => useContext(PortColumnsContext);
