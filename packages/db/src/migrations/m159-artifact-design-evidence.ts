export const m159ArtifactDesignEvidence = /* sql */ `
ALTER TABLE artifact_provenance ADD COLUMN has_design_evidence INTEGER NOT NULL DEFAULT 0 CHECK (has_design_evidence IN (0, 1));
`;
