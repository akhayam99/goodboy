import { createContext } from 'react';

export const ThreadVisitContext = createContext<ReadonlySet<string>>(new Set<string>());
