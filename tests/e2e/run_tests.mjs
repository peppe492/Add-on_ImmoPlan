// tests/e2e/run_tests.mjs
// Master E2E Test Runner for Add-on_ImmoPlan Rent Automation & Digital Receipt System

import { globalContext } from './harness/test_framework.mjs';

// Tier 1: Feature Coverage (F1 - F18)
import './tier1_feature_coverage/f1_dynamic_rent_due_date.test.mjs';
import './tier1_feature_coverage/f2_unified_rent_status_engine.test.mjs';
import './tier1_feature_coverage/f3_server_false_alarm_fix.test.mjs';
import './tier1_feature_coverage/f4_data_models_db_schema.test.mjs';
import './tier1_feature_coverage/f5_telegram_bot_api_client.test.mjs';
import './tier1_feature_coverage/f6_telegram_connection_test.test.mjs';
import './tier1_feature_coverage/f7_home_assistant_sensor_alerts.test.mjs';
import './tier1_feature_coverage/f8_home_assistant_connection_test.test.mjs';
import './tier1_feature_coverage/f9_notification_rest_endpoints.test.mjs';
import './tier1_feature_coverage/f10_pure_vector_pdf_engine.test.mjs';
import './tier1_feature_coverage/f11_sequential_receipt_numbering.test.mjs';
import './tier1_feature_coverage/f12_fiscal_quietanza_content.test.mjs';
import './tier1_feature_coverage/f13_settings_test_ui_panel.test.mjs';
import './tier1_feature_coverage/f14_tenant_telegram_contact.test.mjs';
import './tier1_feature_coverage/f15_rent_monitoring_view_badges.test.mjs';
import './tier1_feature_coverage/f16_quick_action_buttons.test.mjs';
import './tier1_feature_coverage/f17_receipt_preview_export_modal.test.mjs';
import './tier1_feature_coverage/f18_notification_receipt_history_log.test.mjs';

// Tier 2: Boundary & Corner Cases
import './tier2_boundary_corner/rent_calculation_boundaries.test.mjs';
import './tier2_boundary_corner/pdf_receipt_boundaries.test.mjs';
import './tier2_boundary_corner/notification_boundaries.test.mjs';
import './tier2_boundary_corner/persistence_and_ui_boundaries.test.mjs';

// Tier 3: Cross-Feature Combinations
import './tier3_cross_feature/cross_feature_combinations.test.mjs';

// Tier 4: Real-World Application Scenarios
import './tier4_real_world/real_world_lease_lifecycle.test.mjs';

async function main() {
  try {
    const results = await globalContext.runAll();
    if (results.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

main();
