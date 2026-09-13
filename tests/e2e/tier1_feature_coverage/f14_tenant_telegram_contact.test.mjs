// tests/e2e/tier1_feature_coverage/f14_tenant_telegram_contact.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { validateTelegramChatId, getRentQuickActionsState } from '../modules/ui_contract_engine.mjs';
import { evaluateRentStatus } from '../modules/rent_status_engine.mjs';
import { fixturePropertyCedolare, fixtureTenant1 } from '../harness/fixtures.mjs';

describe('Tier 1 - F14: Tenant Telegram Contact Contracts', () => {
  test('T1-F14-01: Accepts valid standard positive numeric Telegram Chat ID', () => {
    const res = validateTelegramChatId('987654321');
    assertTrue(res.valid);
    assertEqual(res.sanitized, '987654321');
  });

  test('T1-F14-02: Accepts valid group/supergroup negative numeric Chat ID', () => {
    const res = validateTelegramChatId('-1001987654321');
    assertTrue(res.valid);
    assertEqual(res.sanitized, '-1001987654321');
  });

  test('T1-F14-03: Rejects invalid non-numeric Telegram username format with helpful guidance', () => {
    const res = validateTelegramChatId('@mario_rossi');
    assertFalse(res.valid);
    assertTrue(res.error.includes('deve essere numerico'));
  });

  test('T1-F14-04: Resolves tenant Telegram Chat ID in rent status evaluation item', () => {
    const rentItem = evaluateRentStatus(fixturePropertyCedolare, fixtureTenant1, [], '2026-09-01');
    assertEqual(rentItem.tenantTelegramChatId, fixtureTenant1.telegramChatId);
  });

  test('T1-F14-05: Disables Telegram receipt send action when tenant has no Chat ID', () => {
    const tenantNoTelegram = { ...fixtureTenant1, telegramChatId: '' };
    const rentItem = evaluateRentStatus(
      fixturePropertyCedolare,
      tenantNoTelegram,
      [{ id: 'p1', propertyId: fixturePropertyCedolare.id, year: 2026, month: 8, income: 850 }],
      '2026-09-06'
    );
    const actionsState = getRentQuickActionsState(rentItem);
    assertFalse(actionsState.canSendReceiptTelegram);
    assertTrue(actionsState.disabledReasons.sendReceiptTelegram.includes('sprovvisto'));
  });
});
