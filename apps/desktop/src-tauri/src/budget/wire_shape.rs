use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_roundtrip, assert_wire_value};

#[test]
fn wire_shape_budget_rule() {
    assert_wire_roundtrip::<BudgetRule>(json!({
        "id": "b1",
        "provider": "claude",
        "period": "month",
        "capUsd": 50.0,
        "alertThresholdPct": 80.0,
        "extraTokensBudget": 1000,
        "createdAt": "2026-01-01T00:00:00Z",
    }));
}

#[test]
fn wire_shape_session_budget() {
    assert_wire_roundtrip::<SessionBudget>(json!({
        "sessionId": "s1",
        "softCapUsd": 5.0,
        "onExceed": "warn",
        "warnRatio": 0.8,
    }));
}

#[test]
fn wire_shape_budget_alert() {
    assert_wire_roundtrip::<BudgetAlert>(json!({
        "id": "a1",
        "kind": "threshold",
        "provider": "claude",
        "sessionId": "s1",
        "currentUsd": 4.0,
        "capUsd": 5.0,
        "createdAt": "2026-01-01T00:00:00Z",
        "dismissedAt": "2026-01-02T00:00:00Z",
    }));
}

#[test]
fn wire_shape_budget_check_result() {
    assert_wire_value(
        &BudgetCheckResult {
            remaining_usd: 1.0,
            pct: 50.0,
            exceeded: false,
            over_threshold: true,
            spent_usd: 2.0,
            cap_usd: Some(3.0),
            threshold_pct: Some(80.0),
            window_start_ms: 10,
            window_end_ms: 20,
        },
        json!({
            "remainingUsd": 1.0,
            "pct": 50.0,
            "exceeded": false,
            "overThreshold": true,
            "spentUsd": 2.0,
            "capUsd": 3.0,
            "thresholdPct": 80.0,
            "windowStartMs": 10,
            "windowEndMs": 20,
        }),
    );
}

#[test]
fn wire_shape_provider_spend_periods() {
    assert_wire_value(
        &ProviderSpendPeriods {
            today_usd: 1.0,
            last_7_days_usd: 2.0,
            this_month_usd: 3.0,
        },
        json!({ "todayUsd": 1.0, "last7DaysUsd": 2.0, "thisMonthUsd": 3.0 }),
    );
}

#[test]
fn wire_shape_provider_budget_overview() {
    assert_wire_value(
        &ProviderBudgetOverview {
            status: BudgetCheckResult {
                remaining_usd: 1.0,
                pct: 50.0,
                exceeded: false,
                over_threshold: false,
                spent_usd: 2.0,
                cap_usd: None,
                threshold_pct: None,
                window_start_ms: 10,
                window_end_ms: 20,
            },
            periods: ProviderSpendPeriods {
                today_usd: 1.0,
                last_7_days_usd: 2.0,
                this_month_usd: 3.0,
            },
        },
        json!({
            "status": {
                "remainingUsd": 1.0,
                "pct": 50.0,
                "exceeded": false,
                "overThreshold": false,
                "spentUsd": 2.0,
                "capUsd": null,
                "thresholdPct": null,
                "windowStartMs": 10,
                "windowEndMs": 20,
            },
            "periods": { "todayUsd": 1.0, "last7DaysUsd": 2.0, "thisMonthUsd": 3.0 },
        }),
    );
}

#[test]
fn wire_shape_emit_alerts_input() {
    assert_wire_reads::<EmitAlertsInput>(json!({
        "provider": "claude",
        "sessionId": "s1",
        "utcOffsetMinutes": 120,
    }));
}
