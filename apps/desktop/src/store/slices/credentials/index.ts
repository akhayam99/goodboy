import { createCredential } from './createCredential';
import { deleteCredential } from './deleteCredential';
import { loadCredentials } from './loadCredentials';
import type { SliceDeps } from '../../slice-types';

export const createCredentialsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadCredentials: loadCredentials(set),
    createCredential: createCredential(set),
    deleteCredential: deleteCredential(set, get),
  };
};
