import { createContext } from 'react';
import type { ListGridColumn } from './listGridTemplate';

export const ListGridColumnsContext = createContext<ReadonlyArray<ListGridColumn>>([]);
