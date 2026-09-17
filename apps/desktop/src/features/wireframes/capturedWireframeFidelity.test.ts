import { describe, expect, it } from 'vitest';
import {
  capturedWireframeFidelity,
  WIREFRAME_FIDELITY_DOWNGRADE_NOTE,
} from './capturedWireframeFidelity';

describe('capturedWireframeFidelity', () => {
  it('keeps high fidelity when it was asked for and a design source survived', () => {
    expect(capturedWireframeFidelity({ requested: 'high', hasDesignSource: true })).toEqual({
      fidelity: 'high',
      note: null,
    });
  });

  it('notes the downgrade when high fidelity was asked for and nothing survived', () => {
    expect(capturedWireframeFidelity({ requested: 'high', hasDesignSource: false })).toEqual({
      fidelity: 'low',
      note: WIREFRAME_FIDELITY_DOWNGRADE_NOTE,
    });
  });

  it('notes nothing when a plain wireframe was asked for, whatever survived', () => {
    expect(capturedWireframeFidelity({ requested: 'low', hasDesignSource: true })).toEqual({
      fidelity: 'low',
      note: null,
    });
  });

  it('notes nothing when the request itself is unknown', () => {
    expect(capturedWireframeFidelity({ requested: null, hasDesignSource: false })).toEqual({
      fidelity: 'low',
      note: null,
    });
  });
});
