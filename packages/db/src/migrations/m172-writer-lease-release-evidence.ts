export const m172WriterLeaseReleaseEvidence = /* sql */ `
ALTER TABLE writer_leases ADD COLUMN released_by TEXT;
ALTER TABLE writer_leases ADD COLUMN release_evidence TEXT;
`;
