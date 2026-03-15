// tests/e2e/ui.spec.js
// Layer 1 — Browser UI tests (no API calls, no network needed)
// Run with: npx playwright test

import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────
async function fillRequiredFields(page) {
  await page.fill('#incidentId', '14573');
  await page.fill('#firstName', 'Jane');
  await page.fill('#lastName', 'Doe');
  await page.fill('#cc', 'Needs shelter and food');
}

// ─────────────────────────────────────────────────────────────
// Page load
// ─────────────────────────────────────────────────────────────
test.describe('Page load', () => {
  test('shows Registration Form tab by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-reg')).toBeVisible();
    await expect(page.locator('#tab-admin')).not.toBeVisible();
  });

  test('timestamps are populated on load', async ({ page }) => {
    await page.goto('/');
    const dateText = await page.locator('#tsDate').textContent();
    expect(dateText).not.toBe('—');
    expect(dateText.length).toBeGreaterThan(4);
  });

  test('incident status shows helper text when empty', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#incSt')).toContainText('Enter Incident ID');
  });

  test('incident status shows checkmark when filled', async ({ page }) => {
    await page.goto('/');
    await page.fill('#incidentId', '14573');
    await expect(page.locator('#incSt')).toContainText('✓ 14573');
  });
});

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────
test.describe('Form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Inject a fake token so validation doesn't stop at token check
    await page.evaluate(() => { window.id_token = 'fake-test-token'; });
  });

  test('shows error toast when Incident ID is missing', async ({ page }) => {
    await page.fill('#firstName', 'Jane');
    await page.fill('#lastName', 'Doe');
    await page.fill('#cc', 'Test');
    await page.click('#saveBtn');
    await expect(page.locator('#toast')).toContainText('Incident ID');
  });

  test('shows error toast when First Name is missing', async ({ page }) => {
    await page.fill('#incidentId', '14573');
    await page.fill('#lastName', 'Doe');
    await page.fill('#cc', 'Test');
    await page.click('#saveBtn');
    await expect(page.locator('#toast')).toContainText('First Name');
  });

  test('shows error toast when Last Name is missing', async ({ page }) => {
    await page.fill('#incidentId', '14573');
    await page.fill('#firstName', 'Jane');
    await page.fill('#cc', 'Test');
    await page.click('#saveBtn');
    await expect(page.locator('#toast')).toContainText('Last Name');
  });

  test('shows error toast when Narrative is missing', async ({ page }) => {
    await page.fill('#incidentId', '14573');
    await page.fill('#firstName', 'Jane');
    await page.fill('#lastName', 'Doe');
    await page.click('#saveBtn');
    await expect(page.locator('#toast')).toContainText('Narrative');
  });

  test('missing field input gets err class (shake animation)', async ({ page }) => {
    await page.fill('#incidentId', '14573');
    await page.fill('#lastName', 'Doe');
    await page.fill('#cc', 'Test');
    await page.click('#saveBtn');
    await expect(page.locator('#firstName')).toHaveClass(/err/);
  });
});

// ─────────────────────────────────────────────────────────────
// DOB / Age interaction
// ─────────────────────────────────────────────────────────────
test.describe('DOB and Age mutual exclusivity', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('entering DOB auto-calculates age and disables age field', async ({ page }) => {
    await page.fill('#dob', '1985-06-15');
    const ageVal = await page.inputValue('#age');
    expect(parseInt(ageVal)).toBeGreaterThan(30);
    await expect(page.locator('#age')).toBeDisabled();
  });

  test('clearing DOB re-enables age field', async ({ page }) => {
    await page.fill('#dob', '1985-06-15');
    await page.fill('#dob', '');
    await page.locator('#dob').dispatchEvent('input');
    await expect(page.locator('#age')).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// Registration Type / Associate Person ID
// ─────────────────────────────────────────────────────────────
test.describe('Registration Type field visibility', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('Associate Person ID is hidden by default (Person selected)', async ({ page }) => {
    await expect(page.locator('#assocPersonRow')).toBeHidden();
  });

  test('Associate Person ID appears when Pet is selected', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await expect(page.locator('#assocPersonRow')).toBeVisible();
  });

  test('Associate Person ID appears when Belonging is selected', async ({ page }) => {
    await page.check('input[name="regType"][value="Belonging"]');
    await expect(page.locator('#assocPersonRow')).toBeVisible();
  });

  test('Associate Person ID hides again when switching back to Person', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await page.check('input[name="regType"][value="Person"]');
    await expect(page.locator('#assocPersonRow')).toBeHidden();
  });

  test('Associate Person ID field clears when hidden', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await page.fill('#assocPersonId', 'ABC123');
    await page.check('input[name="regType"][value="Person"]');
    const val = await page.inputValue('#assocPersonId');
    expect(val).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// Narrative Preview
// ─────────────────────────────────────────────────────────────
test.describe('Narrative preview panel', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('panel is hidden when no appended fields are filled', async ({ page }) => {
    await expect(page.locator('#narrativePreview')).toBeHidden();
  });

  test('panel appears when phone is entered', async ({ page }) => {
    await page.fill('#phone', '555-1234');
    await expect(page.locator('#narrativePreview')).toBeVisible();
    await expect(page.locator('#narrativePreviewRows')).toContainText('555-1234');
  });

  test('panel shows address when city and state filled', async ({ page }) => {
    await page.fill('#city', 'Houston');
    await page.fill('#state', 'TX');
    await expect(page.locator('#narrativePreviewRows')).toContainText('Houston, TX');
  });

  test('shows Registration Type row', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await expect(page.locator('#narrativePreviewRows')).toContainText('Pet');
  });

  test('shows Associate Person ID row when filled', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await page.fill('#assocPersonId', 'WB-001');
    await expect(page.locator('#narrativePreviewRows')).toContainText('WB-001');
  });

  test('panel hides again when all fields cleared', async ({ page }) => {
    await page.fill('#phone', '555-1234');
    await expect(page.locator('#narrativePreview')).toBeVisible();
    await page.fill('#phone', '');
    await page.locator('#phone').dispatchEvent('input');
    await expect(page.locator('#narrativePreview')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────
// Clear Form
// ─────────────────────────────────────────────────────────────
test.describe('Clear Form button', () => {
  test('clears all text fields', async ({ page }) => {
    await page.goto('/');
    await fillRequiredFields(page);
    await page.fill('#phone', '555-1234');

    page.once('dialog', d => d.accept());
    await page.click('#btnClear');

    expect(await page.inputValue('#firstName')).toBe('');
    expect(await page.inputValue('#lastName')).toBe('');
    expect(await page.inputValue('#phone')).toBe('');
    expect(await page.inputValue('#cc')).toBe('');
  });

  test('resets Registration Type to Person', async ({ page }) => {
    await page.goto('/');
    await page.check('input[name="regType"][value="Pet"]');
    page.once('dialog', d => d.accept());
    await page.click('#btnClear');
    const checked = await page.locator('input[name="regType"]:checked').inputValue();
    expect(checked).toBe('Person');
  });

  test('hides Associate Person ID row after clear', async ({ page }) => {
    await page.goto('/');
    await page.check('input[name="regType"][value="Pet"]');
    page.once('dialog', d => d.accept());
    await page.click('#btnClear');
    await expect(page.locator('#assocPersonRow')).toBeHidden();
  });

  test('shows cancelled toast text is NOT shown on cancel', async ({ page }) => {
    await page.goto('/');
    page.once('dialog', d => d.dismiss());
    await page.click('#btnClear');
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
  });
});

// ─────────────────────────────────────────────────────────────
// Language Switching
// ─────────────────────────────────────────────────────────────
test.describe('Language switching', () => {
  const languages = [
    { code: 'es', expectedLabel: 'Nombre' },
    { code: 'zh', expectedLabel: '名' },
    { code: 'tl', expectedLabel: 'Pangalan' },
    { code: 'vi', expectedLabel: 'Tên' },
    { code: 'ar', expectedLabel: 'الاسم الأول' },
    { code: 'fr', expectedLabel: 'Prénom' },
    { code: 'ko', expectedLabel: '이름' },
    { code: 'ru', expectedLabel: 'Имя' },
    { code: 'ht', expectedLabel: 'Prenon' },
  ];

  for (const { code, expectedLabel } of languages) {
    test(`switches to ${code} without JS errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto('/');
      await page.selectOption('#langSel', code);

      expect(errors).toHaveLength(0);
      await expect(page.locator('#lblFirst')).toContainText(expectedLabel);
    });
  }

  test('Arabic applies RTL direction', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#langSel', 'ar');
    const dir = await page.locator('#tab-reg').getAttribute('style');
    expect(dir).toContain('rtl');
  });

  test('switching back to English restores LTR', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#langSel', 'ar');
    await page.selectOption('#langSel', 'en');
    const dir = await page.locator('#tab-reg').getAttribute('style');
    expect(dir).toContain('ltr');
  });
});

// ─────────────────────────────────────────────────────────────
// Missing Person Mode (URL param)
// ─────────────────────────────────────────────────────────────
test.describe('Missing Person mode via URL param', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?mode=missing&incident=99999');
  });

  test('hides Wristband section', async ({ page }) => {
    await expect(page.locator('#wristbandCard')).toBeHidden();
  });

  test('hides Belonging option', async ({ page }) => {
    await expect(page.locator('#rtBelongingLabel')).toBeHidden();
  });

  test('shows Reporter Information card', async ({ page }) => {
    await expect(page.locator('#reporterCard')).toBeVisible();
  });

  test('shows photo callout', async ({ page }) => {
    await expect(page.locator('#missingPhotoCallout')).toBeVisible();
  });

  test('shows Last Known Location field', async ({ page }) => {
    await expect(page.locator('#lastKnownLocation')).toBeVisible();
  });

  test('shows Physical Description field', async ({ page }) => {
    await expect(page.locator('#physicalDesc')).toBeVisible();
  });

  test('hides Associate Person ID even when Pet is selected', async ({ page }) => {
    await page.check('input[name="regType"][value="Pet"]');
    await expect(page.locator('#assocPersonRow')).toBeHidden();
  });

  test('narrative validation uses Missing Person error text', async ({ page }) => {
    await page.evaluate(() => { window.id_token = 'fake-test-token'; });
    await page.fill('#incidentId', '99999');
    await page.fill('#firstName', 'John');
    await page.fill('#lastName', 'Smith');
    await page.click('#saveBtn');
    await expect(page.locator('#toast')).toContainText('Additional Details');
  });

  test('banner has missing class (purple theme)', async ({ page }) => {
    const cls = await page.locator('#formBanner').getAttribute('class');
    expect(cls).toContain('missing');
  });

  test('pre-fills Incident ID from URL', async ({ page }) => {
    const val = await page.inputValue('#incidentId');
    expect(val).toBe('99999');
  });
});

// ─────────────────────────────────────────────────────────────
// Admin tab — Form Mode toggle
// ─────────────────────────────────────────────────────────────
test.describe('Admin Form Mode toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Admin")');
  });

  test('Registration mode is active by default', async ({ page }) => {
    const cls = await page.locator('#modeRegBtn').getAttribute('class');
    expect(cls).toContain('active-reg');
  });

  test('switching to Missing Person shows pre-requisite callout', async ({ page }) => {
    await page.click('#modeMissingBtn');
    await expect(page.locator('#missingModeCallout')).toBeVisible();
  });

  test('switching back to Registration hides callout', async ({ page }) => {
    await page.click('#modeMissingBtn');
    await page.click('#modeRegBtn');
    await expect(page.locator('#missingModeCallout')).toBeHidden();
  });
});
