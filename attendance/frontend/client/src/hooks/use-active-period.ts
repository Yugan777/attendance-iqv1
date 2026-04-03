import { useState, useEffect } from "react";

const PERIOD_TIMES = [
  { start: "08:00", end: "08:45" },
  { start: "08:45", end: "09:30" },
  { start: "09:45", end: "10:30" },
  { start: "10:30", end: "11:15" },
  { start: "11:30", end: "12:15" },
  { start: "12:15", end: "13:00" },
  { start: "14:00", end: "14:45" },
  { start: "14:45", end: "15:30" },
];

export function useActivePeriod(referenceDate?: Date) {
  const [activePeriod, setActivePeriod] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      const now = referenceDate || new Date();
      const day = now.getDay();
      if (day >= 1 && day <= 5) {
        setActiveDay(day - 1);
      } else {
        setActiveDay(null);
      }

      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      let found = false;
      for (let i = 0; i < PERIOD_TIMES.length; i++) {
        if (currentTime >= PERIOD_TIMES[i].start && currentTime < PERIOD_TIMES[i].end) {
          setActivePeriod(i);
          found = true;
          break;
        }
      }
      if (!found) setActivePeriod(null);
    }

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [referenceDate]);

  return { activePeriod, activeDay, periodTimes: PERIOD_TIMES };
}
