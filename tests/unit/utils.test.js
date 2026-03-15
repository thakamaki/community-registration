// tests/unit/utils.test.js
// Layer 2 — Pure logic unit tests (no browser, no network)
// Run with: npm test

import { describe, it, expect } from 'vitest';
import {
  buildChiefComplaint,
  buildPayload,
  validateFields,
  shouldShowAssocPersonId,
  shouldShowBelonging,
  calcAgeFromDob,
  buildQrUrl,
} from '../../utils.js';

// ─────────────────────────────────────────────────────────────
// buildChiefComplaint
// ─────────────────────────────────────────────────────────────
describe('buildChiefComplaint — Registration mode', () => {
  it('wraps narrative in [Person] tag by default', () => {
    const result = buildChiefComplaint({ narrative: 'Needs shelter' });
    expect(result).toBe('[Person] Needs shelter');
  });

  it('appends phone when provided', () => {
    const result = buildChiefComplaint({ narrative: 'OK', phone: '555-1234' });
    expect(result).toContain('Ph: 555-1234');
  });

  it('appends full address when all parts provided', () => {
    const result = buildChiefComplaint({
      narrative: 'OK',
      address: '100 Oak St', city: 'Houston', state: 'TX', zip: '77001',
    });
    expect(result).toContain('100 Oak St, Houston, TX, 77001');
  });

  it('omits address parts that are empty', () => {
    const result = buildChiefComplaint({ narrative: 'OK', city: 'Houston', state: 'TX' });
    expect(result).toContain('Houston, TX');
    expect(result).not.toContain('undefined');
  });

  it('appends AssocPersonID for Pet', () => {
    const result = buildChiefComplaint({ regType: 'Pet', narrative: 'Black lab', assocPersonId: '98234' });
    expect(result).toContain('AssocPersonID: 98234');
  });

  it('appends AssocPersonID for Belonging', () => {
    const result = buildChiefComplaint({ regType: 'Belonging', narrative: 'Blue backpack', assocPersonId: '12345' });
    expect(result).toContain('AssocPersonID: 12345');
  });

  it('does NOT append AssocPersonID for Person even if value present', () => {
    const result = buildChiefComplaint({ regType: 'Person', narrative: 'OK', assocPersonId: '99999' });
    expect(result).not.toContain('AssocPersonID');
  });

  it('does NOT append AssocPersonID when empty', () => {
    const result = buildChiefComplaint({ regType: 'Pet', narrative: 'Cat', assocPersonId: '' });
    expect(result).not.toContain('AssocPersonID');
  });

  it('uses [Pet] type label', () => {
    const result = buildChiefComplaint({ regType: 'Pet', narrative: 'Cat' });
    expect(result).toMatch(/^\[Pet\]/);
  });

  it('uses [Belonging] type label', () => {
    const result = buildChiefComplaint({ regType: 'Belonging', narrative: 'Bag' });
    expect(result).toMatch(/^\[Belonging\]/);
  });

  it('truncates to 255 characters', () => {
    const long = 'A'.repeat(300);
    const result = buildChiefComplaint({ narrative: long });
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('does not add brackets when no extras present', () => {
    const result = buildChiefComplaint({ narrative: 'Simple note' });
    expect(result).toBe('[Person] Simple note');
    expect(result).not.toContain('[Ph:');
  });
});

describe('buildChiefComplaint — Missing Person mode', () => {
  it('uses [Missing Person] type label', () => {
    const result = buildChiefComplaint({ mode: 'missing', narrative: 'Elderly male' });
    expect(result).toMatch(/^\[Missing Person\]/);
  });

  it('appends LastSeen when provided', () => {
    const result = buildChiefComplaint({ mode: 'missing', narrative: 'OK', lastKnownLocation: 'Minute Maid Park' });
    expect(result).toContain('LastSeen: Minute Maid Park');
  });

  it('appends Desc when provided', () => {
    const result = buildChiefComplaint({ mode: 'missing', narrative: 'OK', physicalDesc: 'Grey hair, blue jacket' });
    expect(result).toContain('Desc: Grey hair, blue jacket');
  });

  it('appends Reporter name and phone', () => {
    const result = buildChiefComplaint({
      mode: 'missing', narrative: 'OK',
      reporterFirst: 'Maria', reporterLast: 'Gonzalez',
      reporterPhone: '555-9999', reporterRelation: 'Daughter',
    });
    expect(result).toContain('Reporter: Maria Gonzalez (Daughter)');
    expect(result).toContain('ReporterPh: 555-9999');
  });

  it('omits Reporter section when all reporter fields empty', () => {
    const result = buildChiefComplaint({ mode: 'missing', narrative: 'OK' });
    expect(result).not.toContain('Reporter:');
    expect(result).not.toContain('ReporterPh:');
  });

  it('does NOT append AssocPersonID even if value present', () => {
    const result = buildChiefComplaint({ mode: 'missing', narrative: 'OK', assocPersonId: '99999' });
    expect(result).not.toContain('AssocPersonID');
  });

  it('omits relation parentheses when relation is empty', () => {
    const result = buildChiefComplaint({
      mode: 'missing', narrative: 'OK',
      reporterFirst: 'John', reporterLast: 'Doe', reporterRelation: '',
    });
    expect(result).toContain('Reporter: John Doe');
    expect(result).not.toContain('()');
  });
});

// ─────────────────────────────────────────────────────────────
// buildPayload
// ─────────────────────────────────────────────────────────────
describe('buildPayload', () => {
  const base = { firstName: 'Jane', lastName: 'Doe', narrative: 'Needs help', incidentId: '14573' };

  it('includes name.first and name.last', () => {
    const p = buildPayload(base);
    expect(p.name.first).toBe('Jane');
    expect(p.name.last).toBe('Doe');
  });

  it('truncates first/last name to 20 chars', () => {
    const p = buildPayload({ ...base, firstName: 'A'.repeat(25), lastName: 'B'.repeat(25) });
    expect(p.name.first.length).toBeLessThanOrEqual(20);
    expect(p.name.last.length).toBeLessThanOrEqual(20);
  });

  it('sets method_of_arrival to 5', () => {
    const p = buildPayload(base);
    expect(p.case.method_of_arrival).toBe(5);
  });

  it('adds collaboration when incidentId is a valid integer', () => {
    const p = buildPayload(base);
    expect(p.add_collaborations).toEqual([{ collaboration_id: 14573 }]);
  });

  it('omits collaboration when incidentId is empty', () => {
    const p = buildPayload({ ...base, incidentId: '' });
    expect(p.add_collaborations).toBeUndefined();
  });

  it('sends dob object when DOB is present', () => {
    const p = buildPayload({ ...base, dob: '1985-06-15' });
    expect(p.dob).toEqual({ day: 15, month: 6, year: 1985 });
    expect(p.age_in_units).toBeUndefined();
  });

  it('sends age_in_units when age present and DOB absent', () => {
    const p = buildPayload({ ...base, dob: '', age: '45' });
    expect(p.age_in_units).toEqual({ age: 45, units: 1 });
    expect(p.dob).toBeUndefined();
  });

  it('DOB takes priority over age — does not send both', () => {
    const p = buildPayload({ ...base, dob: '1980-01-01', age: '44' });
    expect(p.dob).toBeDefined();
    expect(p.age_in_units).toBeUndefined();
  });

  it('omits age_in_units for invalid age values', () => {
    const p1 = buildPayload({ ...base, age: '0' });
    const p2 = buildPayload({ ...base, age: '121' });
    const p3 = buildPayload({ ...base, age: 'abc' });
    expect(p1.age_in_units).toBeUndefined();
    expect(p2.age_in_units).toBeUndefined();
    expect(p3.age_in_units).toBeUndefined();
  });

  it('includes gender when provided', () => {
    const p = buildPayload({ ...base, gender: 'female' });
    expect(p.gender).toBe('female');
  });

  it('omits gender when not provided', () => {
    const p = buildPayload(base);
    expect(p.gender).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// validateFields
// ─────────────────────────────────────────────────────────────
describe('validateFields', () => {
  const valid = {
    incidentId: '14573', firstName: 'Jane', lastName: 'Doe',
    narrative: 'Needs help', idToken: 'tok_abc', mode: 'registration',
  };

  it('returns valid: true when all fields present', () => {
    expect(validateFields(valid).valid).toBe(true);
  });

  it('fails when incidentId is missing', () => {
    const r = validateFields({ ...valid, incidentId: '' });
    expect(r.valid).toBe(false);
    expect(r.errorField).toBe('incidentId');
    expect(r.errorKey).toBe('valIncident');
  });

  it('fails when firstName is missing', () => {
    const r = validateFields({ ...valid, firstName: '' });
    expect(r.valid).toBe(false);
    expect(r.errorField).toBe('firstName');
  });

  it('fails when lastName is missing', () => {
    const r = validateFields({ ...valid, lastName: '' });
    expect(r.valid).toBe(false);
    expect(r.errorField).toBe('lastName');
  });

  it('fails when narrative is missing', () => {
    const r = validateFields({ ...valid, narrative: '' });
    expect(r.valid).toBe(false);
    expect(r.errorField).toBe('cc');
  });

  it('uses valCCMissing error key in missing person mode', () => {
    const r = validateFields({ ...valid, narrative: '', mode: 'missing' });
    expect(r.errorKey).toBe('valCCMissing');
  });

  it('fails when idToken is null', () => {
    const r = validateFields({ ...valid, idToken: null });
    expect(r.valid).toBe(false);
    expect(r.errorKey).toBe('valNoToken');
  });

  it('fails on whitespace-only fields', () => {
    const r = validateFields({ ...valid, firstName: '   ' });
    expect(r.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// shouldShowAssocPersonId
// ─────────────────────────────────────────────────────────────
describe('shouldShowAssocPersonId', () => {
  it('shows for Pet in registration mode', () => {
    expect(shouldShowAssocPersonId('registration', 'Pet')).toBe(true);
  });

  it('shows for Belonging in registration mode', () => {
    expect(shouldShowAssocPersonId('registration', 'Belonging')).toBe(true);
  });

  it('hides for Person', () => {
    expect(shouldShowAssocPersonId('registration', 'Person')).toBe(false);
  });

  it('always hides in missing person mode', () => {
    expect(shouldShowAssocPersonId('missing', 'Pet')).toBe(false);
    expect(shouldShowAssocPersonId('missing', 'Belonging')).toBe(false);
    expect(shouldShowAssocPersonId('missing', 'Person')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// shouldShowBelonging
// ─────────────────────────────────────────────────────────────
describe('shouldShowBelonging', () => {
  it('shows Belonging in registration mode', () => {
    expect(shouldShowBelonging('registration')).toBe(true);
  });

  it('hides Belonging in missing person mode', () => {
    expect(shouldShowBelonging('missing')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// calcAgeFromDob
// ─────────────────────────────────────────────────────────────
describe('calcAgeFromDob', () => {
  const fixedNow = new Date('2026-03-14');

  it('calculates correct age', () => {
    expect(calcAgeFromDob('1985-06-15', fixedNow)).toBe(40);
  });

  it('handles birthday not yet reached this year', () => {
    expect(calcAgeFromDob('1985-12-31', fixedNow)).toBe(40);
  });

  it('handles birthday already passed this year', () => {
    expect(calcAgeFromDob('1985-01-01', fixedNow)).toBe(41);
  });

  it('returns null for empty string', () => {
    expect(calcAgeFromDob('')).toBeNull();
  });

  it('returns null for future DOB', () => {
    expect(calcAgeFromDob('2030-01-01', fixedNow)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// buildQrUrl
// ─────────────────────────────────────────────────────────────
describe('buildQrUrl', () => {
  const base = 'https://community-reg.vercel.app';
  const token = 'test-token-123';

  it('builds a basic registration URL', () => {
    const url = buildQrUrl(base, '14573', token);
    expect(url).toContain('incident=14573');
    expect(url).toContain('ref=');
    expect(url).not.toContain('mode=missing');
  });

  it('appends mode=missing for missing person mode', () => {
    const url = buildQrUrl(base, '14573', token, 'missing');
    expect(url).toContain('mode=missing');
  });

  it('does NOT append mode param for registration mode', () => {
    const url = buildQrUrl(base, '14573', token, 'registration');
    expect(url).not.toContain('mode=');
  });

  it('appends cp label when provided', () => {
    const url = buildQrUrl(base, '14573', token, 'registration', 'North Gym');
    expect(url).toContain('cp=North%20Gym');
  });

  it('omits cp param when label is empty', () => {
    const url = buildQrUrl(base, '14573', token, 'registration', '');
    expect(url).not.toContain('cp=');
  });

  it('base64-encodes the token in ref param', () => {
    const url = buildQrUrl(base, '14573', token);
    const encoded = encodeURIComponent(btoa(token));
    expect(url).toContain(`ref=${encoded}`);
  });
});
