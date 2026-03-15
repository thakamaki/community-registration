// utils.js
// Extracted pure functions from index.html for unit testing.
// No DOM references — safe to import in Vitest without a browser.

const MOA_ED_PATIENT  = 5;
const AGE_UNITS_YEARS = 1;

/**
 * Assembles the chief_complaint string from form field values.
 * @param {object} fields - All relevant form field values
 * @param {string} fields.mode         - 'registration' | 'missing'
 * @param {string} fields.regType      - 'Person' | 'Pet' | 'Belonging'
 * @param {string} fields.narrative    - Free-text narrative
 * @param {string} fields.phone        - Phone number
 * @param {string} fields.address      - Street address
 * @param {string} fields.city
 * @param {string} fields.state
 * @param {string} fields.zip
 * @param {string} fields.assocPersonId
 * @param {string} fields.lastKnownLocation  - Missing Person only
 * @param {string} fields.physicalDesc       - Missing Person only
 * @param {string} fields.reporterFirst      - Missing Person only
 * @param {string} fields.reporterLast       - Missing Person only
 * @param {string} fields.reporterPhone      - Missing Person only
 * @param {string} fields.reporterRelation   - Missing Person only
 * @returns {string} Assembled chief_complaint (max 255 chars)
 */
export function buildChiefComplaint(fields) {
  const {
    mode = 'registration',
    regType = 'Person',
    narrative = '',
    phone = '',
    address = '', city = '', state = '', zip = '',
    assocPersonId = '',
    lastKnownLocation = '', physicalDesc = '',
    reporterFirst = '', reporterLast = '',
    reporterPhone = '', reporterRelation = '',
  } = fields;

  const isMissing = mode === 'missing';
  const typeLabel = isMissing ? 'Missing Person' : regType;
  const addr = [address, city, state, zip].filter(Boolean).join(', ');

  const extras = [];
  const contactInfo = [phone ? `Ph: ${phone}` : '', addr].filter(Boolean).join(' | ');
  if (contactInfo) extras.push(contactInfo);

  if (!isMissing && assocPersonId && (regType === 'Pet' || regType === 'Belonging')) {
    extras.push(`AssocPersonID: ${assocPersonId}`);
  }

  if (isMissing) {
    if (lastKnownLocation) extras.push(`LastSeen: ${lastKnownLocation}`);
    if (physicalDesc)       extras.push(`Desc: ${physicalDesc}`);
    const repName = [reporterFirst, reporterLast].filter(Boolean).join(' ');
    if (repName) extras.push(`Reporter: ${repName}${reporterRelation ? ` (${reporterRelation})` : ''}`);
    if (reporterPhone) extras.push(`ReporterPh: ${reporterPhone}`);
  }

  const base = `[${typeLabel}] ${narrative}`;
  const full = extras.length ? `${base} [${extras.join(' | ')}]` : base;
  return full.substring(0, 255);
}

/**
 * Builds the full Pulsara patient channel POST payload.
 * @param {object} fields - Same shape as buildChiefComplaint plus name/dob/age/gender/incidentId
 * @returns {object} Pulsara API payload
 */
export function buildPayload(fields) {
  const {
    firstName = '', lastName = '',
    dob = '',       age = '',
    gender = '',    incidentId = '',
  } = fields;

  const payload = {
    name: {
      first: firstName.trim().substring(0, 20),
      last:  lastName.trim().substring(0, 20),
    },
    chief_complaint: buildChiefComplaint(fields),
    case: { method_of_arrival: MOA_ED_PATIENT },
  };

  if (dob) {
    const [y, mo, d] = dob.split('-').map(Number);
    if (y && mo && d) payload.dob = { day: d, month: mo, year: y };
  } else {
    const ageVal = parseInt(age);
    if (!isNaN(ageVal) && ageVal >= 1 && ageVal <= 120) {
      payload.age_in_units = { age: ageVal, units: AGE_UNITS_YEARS };
    }
  }

  if (gender) payload.gender = gender;

  const incId = parseInt(incidentId);
  if (!isNaN(incId) && incId > 0) {
    payload.add_collaborations = [{ collaboration_id: incId }];
  }

  return payload;
}

/**
 * Validates required fields before submission.
 * @param {object} fields
 * @returns {{ valid: boolean, errorField: string|null, errorKey: string|null }}
 */
export function validateFields(fields) {
  const { incidentId, firstName, lastName, narrative, mode, idToken } = fields;
  if (!incidentId?.trim()) return { valid: false, errorField: 'incidentId', errorKey: 'valIncident' };
  if (!firstName?.trim())  return { valid: false, errorField: 'firstName',  errorKey: 'valFirst' };
  if (!lastName?.trim())   return { valid: false, errorField: 'lastName',   errorKey: 'valLast' };
  if (!narrative?.trim())  return { valid: false, errorField: 'cc',         errorKey: mode === 'missing' ? 'valCCMissing' : 'valCC' };
  if (!idToken)            return { valid: false, errorField: null,         errorKey: 'valNoToken' };
  return { valid: true, errorField: null, errorKey: null };
}

/**
 * Determines whether the Associate Person ID field should be visible.
 * @param {string} mode     - 'registration' | 'missing'
 * @param {string} regType  - 'Person' | 'Pet' | 'Belonging'
 * @returns {boolean}
 */
export function shouldShowAssocPersonId(mode, regType) {
  return mode !== 'missing' && (regType === 'Pet' || regType === 'Belonging');
}

/**
 * Determines whether Belonging option should be visible.
 * @param {string} mode
 * @returns {boolean}
 */
export function shouldShowBelonging(mode) {
  return mode !== 'missing';
}

/**
 * Calculates age from a DOB string (YYYY-MM-DD).
 * @param {string} dobStr
 * @param {Date}   [now]   - Injectable for testing
 * @returns {number|null}
 */
export function calcAgeFromDob(dobStr, now = new Date()) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * Builds the QR registration URL.
 * @param {string} baseUrl
 * @param {string} incidentId
 * @param {string} idToken
 * @param {string} [mode]
 * @param {string} [cpLabel]
 * @returns {string}
 */
export function buildQrUrl(baseUrl, incidentId, idToken, mode = 'registration', cpLabel = '') {
  let url = `${baseUrl}?incident=${encodeURIComponent(incidentId)}&ref=${encodeURIComponent(btoa(idToken))}`;
  if (cpLabel) url += `&cp=${encodeURIComponent(cpLabel)}`;
  if (mode === 'missing') url += `&mode=missing`;
  return url;
}
