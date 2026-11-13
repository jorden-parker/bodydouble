import { useEffect, useState } from "react";
import { dayKey, shiftDay } from "@/lib/metrics/buckets";
import type { DayRange } from "@/lib/metrics/summary";
import type { WorkReport } from "@/lib/metrics/work";
import { messageOf, type TallyApi } from "../api";

const DAYS_BEFORE_TODAY = 29;

function lastThirtyDays(now: Date): DayRange {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const today = dayKey(now.toISOString(), timeZone);
  return { from: shiftDay(today, -DAYS_BEFORE_TODAY), to: today };
}

export function useWorkLog(api: TallyApi, now: () => Date) {
  const [period, setPeriod] = useState(() => lastThirtyDays(now()));
  const [report, setReport] = useState<WorkReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const complete = period.from !== "" && period.to !== "";

  useEffect(() => {
    if (!complete) return;
    let current = true;
    api
      .fetchWork(period)
      .then((loaded) => {
        if (!current) return;
        setReport(loaded);
        setProblem(null);
      })
      .catch((error) => current && setProblem(messageOf(error)));
    return () => {
      current = false;
    };
  }, [api, period, complete]);

  const matchesPeriod = report?.from === period.from && report?.to === period.to;

  return {
    period,
    setPeriod,
    report: complete && matchesPeriod && problem === null ? report : null,
    problem: complete ? problem : "Choose both dates.",
  };
}
