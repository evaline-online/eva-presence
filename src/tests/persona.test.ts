/**
 * eva-presence / tests/persona.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EVA_PERSONA, ADAM_PERSONA, getPersona } from '../core/EvaPersona.js';

describe('EvaPersona tests', () => {
  it('should return Eva persona as default', () => {
    const p = getPersona();
    assert.equal(p.id, 'eva');
    assert.equal(p.gender, 'female');
    assert.match(p.name, /Eva|Ева/);
  });

  it('should return Adam persona when requested', () => {
    const p = getPersona('adam');
    assert.equal(p.id, 'adam');
    assert.equal(p.gender, 'male');
    assert.match(p.name, /Adam|Адам/);
  });

  it('should include multilingual competencies', () => {
    assert.ok(EVA_PERSONA.languages.includes('ru'));
    assert.ok(EVA_PERSONA.languages.includes('uk'));
    assert.ok(EVA_PERSONA.languages.includes('en'));
  });
});
