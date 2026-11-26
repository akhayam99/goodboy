import { createContext } from 'react';
import type { PortColumns } from './portColumns';

export const PortColumnsContext = createContext<PortColumns>('full');
