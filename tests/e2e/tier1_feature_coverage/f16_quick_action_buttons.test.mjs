// tests/e2e/tier1_feature_coverage/f16_quick_action_buttons.test.mjs
import { describe, test, assertEqual, assertTrue, assertFalse } from '../harness/test_framework.mjs';
import { getRentQuickActionsState } from '../modules/ui_contract_engine.mjs';

describe('Tier 1 - F16: Quick Action Buttons', () => {
  test('T1-F16-01: Enables "Invia Promemoria Manuale" for unpaid upcoming or overdue rent', () => {
    const upcomingRent = { status: 'IN_SCADENZA', tenantTelegramChatId: '12345' };
    const overdueRent = { status: 'SCADUTO', tenantTelegramChatId: '12345' };

    assertTrue(getRentQuickActionsState(upcomingRent).canSendReminder);
    assertTrue(getRentQuickActionsState(overdueRent).canSendReminder);
  });

  test('T1-F16-02: Disables "Invia Promemoria Manuale" when rent is already SALDATO', () => {
    const paidRent = { status: 'SALDATO', tenantTelegramChatId: '12345' };
    const state = getRentQuickActionsState(paidRent);
    assertFalse(state.canSendReminder);
    assertEqual(state.disabledReasons.sendReminder, 'Canone già saldato');
  });

  test('T1-F16-03: Enables "Genera Ricevuta" only when rent is SALDATO', () => {
    const paidRent = { status: 'SALDATO', tenantTelegramChatId: '12345' };
    const unpaidRent = { status: 'SCADUTO', tenantTelegramChatId: '12345' };

    assertTrue(getRentQuickActionsState(paidRent).canGenerateReceipt);
    assertFalse(getRentQuickActionsState(unpaidRent).canGenerateReceipt);
  });

  test('T1-F16-04: Enables "Invia Ricevuta via Telegram" when SALDATO and tenant has Chat ID', () => {
    const paidWithTelegram = { status: 'SALDATO', tenantTelegramChatId: '987654321' };
    assertTrue(getRentQuickActionsState(paidWithTelegram).canSendReceiptTelegram);
  });

  test('T1-F16-05: Disables "Invia Ricevuta via Telegram" when tenant has no Chat ID', () => {
    const paidNoTelegram = { status: 'SALDATO', tenantTelegramChatId: null };
    const state = getRentQuickActionsState(paidNoTelegram);
    assertFalse(state.canSendReceiptTelegram);
    assertTrue(state.disabledReasons.sendReceiptTelegram.includes('sprovvisto'));
  });
});
