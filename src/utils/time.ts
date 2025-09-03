// Local day/week helpers (use system timezone)
export function isoDay(d = new Date()): string {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  export function isoWeek(d = new Date()): string {
    // ISO week based on local date
    const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // Thursday in current week decides the year
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }