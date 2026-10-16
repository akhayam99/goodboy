import { createContext } from 'react';
import type { RecordFrame } from './RecordActions/types';

export const RecordFrameContext = createContext<RecordFrame | null>(null);
