use chrono::{Datelike, Days, NaiveDate, NaiveDateTime, NaiveTime, Weekday};

use super::time::{first_of_next_month, nth_weekday, parse_local, parse_weekday_token, weekday_of};

const MAX_PERIODS: u32 = 40_000;
const MAX_OCCURRENCES: usize = 2_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Freq {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Until {
    Instant(i64),
    Local(NaiveDateTime),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Rule {
    pub freq: Freq,
    pub interval: u32,
    pub count: Option<u32>,
    pub until: Option<Until>,
    pub by_day: Vec<(i32, Weekday)>,
    pub by_month_day: Vec<i32>,
    pub week_start: Weekday,
}

pub(crate) fn parse_rule(value: &str) -> Option<Rule> {
    let mut rule = Rule {
        freq: Freq::Daily,
        interval: 1,
        count: None,
        until: None,
        by_day: Vec::new(),
        by_month_day: Vec::new(),
        week_start: Weekday::Mon,
    };
    let mut freq = None;
    for part in value.split(';') {
        let Some((key, raw)) = part.split_once('=') else {
            continue;
        };
        let raw = raw.trim();
        match key.trim().to_ascii_uppercase().as_str() {
            "FREQ" => {
                freq = match raw.to_ascii_uppercase().as_str() {
                    "DAILY" => Some(Freq::Daily),
                    "WEEKLY" => Some(Freq::Weekly),
                    "MONTHLY" => Some(Freq::Monthly),
                    "YEARLY" => Some(Freq::Yearly),
                    _ => return None,
                }
            }
            "INTERVAL" => rule.interval = raw.parse().ok().filter(|value| *value > 0)?,
            "COUNT" => rule.count = Some(raw.parse().ok()?),
            "UNTIL" => {
                let (local, _, is_utc) = parse_local(raw)?;
                rule.until = Some(match is_utc {
                    true => Until::Instant(local.and_utc().timestamp_millis()),
                    false => Until::Local(local),
                });
            }
            "BYDAY" => rule.by_day = raw.split(',').filter_map(parse_weekday_token).collect(),
            "BYMONTHDAY" => {
                rule.by_month_day = raw
                    .split(',')
                    .filter_map(|day| day.trim().parse().ok())
                    .filter(|day: &i32| *day != 0 && day.abs() <= 31)
                    .collect()
            }
            "WKST" => rule.week_start = weekday_of(raw).unwrap_or(Weekday::Mon),
            _ => {}
        }
    }
    rule.freq = freq?;
    Some(rule)
}

fn month_day(year: i32, month: u32, day: i32) -> Option<NaiveDate> {
    if day > 0 {
        return NaiveDate::from_ymd_opt(year, month, u32::try_from(day).ok()?);
    }
    first_of_next_month(year, month)?.checked_sub_days(Days::new(u64::from(day.unsigned_abs())))
}

fn every_weekday_in_month(year: i32, month: u32, weekday: Weekday) -> Vec<NaiveDate> {
    (1..=5)
        .filter_map(|ordinal| nth_weekday(year, month, ordinal, weekday))
        .collect()
}

fn days_in_period(rule: &Rule, start: NaiveDate, period: u32) -> Vec<NaiveDate> {
    let step = u64::from(period) * u64::from(rule.interval);
    let mut dates: Vec<NaiveDate> = match rule.freq {
        Freq::Daily => start
            .checked_add_days(Days::new(step))
            .into_iter()
            .filter(|date| {
                rule.by_day.is_empty() || rule.by_day.iter().any(|(_, day)| *day == date.weekday())
            })
            .collect(),
        Freq::Weekly => {
            let back = (7 + start.weekday().num_days_from_monday()
                - rule.week_start.num_days_from_monday())
                % 7;
            let Some(week) = start
                .checked_sub_days(Days::new(u64::from(back)))
                .and_then(|monday| monday.checked_add_days(Days::new(step * 7)))
            else {
                return Vec::new();
            };
            let wanted: Vec<Weekday> = match rule.by_day.is_empty() {
                true => vec![start.weekday()],
                false => rule.by_day.iter().map(|(_, day)| *day).collect(),
            };
            (0..7)
                .filter_map(|offset| week.checked_add_days(Days::new(offset)))
                .filter(|date| wanted.contains(&date.weekday()))
                .collect()
        }
        Freq::Monthly => {
            let months = i64::from(start.year()) * 12 + i64::from(start.month0()) + step as i64;
            let Ok(year) = i32::try_from(months.div_euclid(12)) else {
                return Vec::new();
            };
            let month = months.rem_euclid(12) as u32 + 1;
            match (rule.by_day.is_empty(), rule.by_month_day.is_empty()) {
                (false, _) => rule
                    .by_day
                    .iter()
                    .flat_map(|(ordinal, weekday)| match ordinal {
                        0 => every_weekday_in_month(year, month, *weekday),
                        _ => nth_weekday(year, month, *ordinal, *weekday).into_iter().collect(),
                    })
                    .collect(),
                (true, false) => rule
                    .by_month_day
                    .iter()
                    .filter_map(|day| month_day(year, month, *day))
                    .collect(),
                (true, true) => NaiveDate::from_ymd_opt(year, month, start.day())
                    .into_iter()
                    .collect(),
            }
        }
        Freq::Yearly => i32::try_from(step)
            .ok()
            .and_then(|years| NaiveDate::from_ymd_opt(start.year() + years, start.month(), start.day()))
            .into_iter()
            .collect(),
    };
    dates.sort();
    dates.dedup();
    dates
}

fn is_past_until(until: Option<Until>, local: NaiveDateTime, instant: i64) -> bool {
    match until {
        None => false,
        Some(Until::Instant(limit)) => instant > limit,
        Some(Until::Local(limit)) if limit.time() == NaiveTime::MIN => local.date() > limit.date(),
        Some(Until::Local(limit)) => local > limit,
    }
}

pub(crate) struct Expansion<'a> {
    pub rule: &'a Rule,
    pub start: NaiveDateTime,
    pub duration_ms: i64,
    pub from_ms: i64,
    pub to_ms: i64,
    pub instant: &'a dyn Fn(NaiveDateTime) -> i64,
}

pub(crate) fn expand(expansion: &Expansion) -> Vec<(NaiveDateTime, i64)> {
    let Expansion {
        rule,
        start,
        duration_ms,
        from_ms,
        to_ms,
        instant,
    } = expansion;
    let mut found = Vec::new();
    let mut count = 0u32;
    let mut take = |local: NaiveDateTime, found: &mut Vec<(NaiveDateTime, i64)>| -> bool {
        let at = instant(local);
        if is_past_until(rule.until, local, at) || at >= *to_ms {
            return false;
        }
        count += 1;
        if rule.count.is_some_and(|limit| count > limit) {
            return false;
        }
        if at + duration_ms > *from_ms {
            found.push((local, at));
        }
        found.len() < MAX_OCCURRENCES
    };
    if !take(*start, &mut found) {
        return found;
    }
    for period in 0..MAX_PERIODS {
        for date in days_in_period(rule, start.date(), period) {
            let local = date.and_time(start.time());
            if local <= *start {
                continue;
            }
            if !take(local, &mut found) {
                return found;
            }
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(text: &str) -> NaiveDateTime {
        parse_local(text).unwrap().0
    }

    fn utc(local: NaiveDateTime) -> i64 {
        local.and_utc().timestamp_millis()
    }

    fn run(rule: &str, start: &str, from: &str, to: &str) -> Vec<NaiveDateTime> {
        let rule = parse_rule(rule).unwrap();
        expand(&Expansion {
            rule: &rule,
            start: at(start),
            duration_ms: 30 * 60_000,
            from_ms: utc(at(from)),
            to_ms: utc(at(to)),
            instant: &utc,
        })
        .into_iter()
        .map(|(local, _)| local)
        .collect()
    }

    #[test]
    fn daily_with_a_count_stops_after_the_count() {
        assert_eq!(
            run("FREQ=DAILY;COUNT=3", "20261123T090000", "20261101T000000", "20261231T000000"),
            vec![at("20261123T090000"), at("20261124T090000"), at("20261125T090000")]
        );
    }

    #[test]
    fn weekly_on_chosen_days_fills_each_week() {
        assert_eq!(
            run(
                "FREQ=WEEKLY;BYDAY=MO,WE,FR",
                "20261123T093000",
                "20261123T000000",
                "20261130T000000"
            ),
            vec![at("20261123T093000"), at("20261125T093000"), at("20261127T093000")]
        );
    }

    #[test]
    fn weekly_every_two_weeks_skips_the_week_between() {
        assert_eq!(
            run(
                "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
                "20261103T100000",
                "20261101T000000",
                "20261201T000000"
            ),
            vec![at("20261103T100000"), at("20261117T100000")]
        );
    }

    #[test]
    fn until_in_utc_is_the_last_moment_and_a_date_until_keeps_that_day() {
        assert_eq!(
            run(
                "FREQ=DAILY;UNTIL=20261125T090000Z",
                "20261123T090000",
                "20261101T000000",
                "20261231T000000"
            )
            .len(),
            3
        );
        assert_eq!(
            run(
                "FREQ=DAILY;UNTIL=20261125",
                "20261123T090000",
                "20261101T000000",
                "20261231T000000"
            )
            .len(),
            3
        );
    }

    #[test]
    fn the_count_includes_occurrences_before_the_range() {
        assert_eq!(
            run("FREQ=DAILY;COUNT=5", "20261120T090000", "20261123T000000", "20261231T000000"),
            vec![at("20261123T090000"), at("20261124T090000")]
        );
    }

    #[test]
    fn an_old_daily_series_still_reaches_today() {
        assert_eq!(
            run("FREQ=DAILY", "20150105T090000", "20261127T000000", "20261128T000000"),
            vec![at("20261127T090000")]
        );
    }

    #[test]
    fn monthly_by_ordinal_weekday_and_by_month_day() {
        assert_eq!(
            run("FREQ=MONTHLY;BYDAY=-1FR", "20261030T150000", "20261101T000000", "20270101T000000"),
            vec![at("20261127T150000"), at("20261225T150000")]
        );
        assert_eq!(
            run("FREQ=MONTHLY", "20261031T150000", "20261101T000000", "20270201T000000"),
            vec![at("20261231T150000"), at("20270131T150000")]
        );
    }

    #[test]
    fn workdays_daily_skips_the_weekend() {
        assert_eq!(
            run(
                "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
                "20261127T090000",
                "20261127T000000",
                "20261201T000000"
            ),
            vec![at("20261127T090000"), at("20261130T090000")]
        );
    }

    #[test]
    fn an_unknown_frequency_is_not_a_rule() {
        assert_eq!(parse_rule("FREQ=HOURLY"), None);
        assert_eq!(parse_rule("INTERVAL=2"), None);
    }
}
