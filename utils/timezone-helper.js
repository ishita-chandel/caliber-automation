/**
 * Timezone & Dynamic Booking Slot Utility
 * Handles timezone conversions, target time calculation (+2 hours from range-local time),
 * date formatting, and slot matching using Intl.DateTimeFormat.
 */

/**
 * Returns detailed date and time breakdown in the specified IANA timezone.
 * @param {string} timeZone - IANA timezone identifier, e.g. "America/Anchorage", "America/Chicago"
 * @param {Date} [date=new Date()]
 */
function getRangeLocalTime(timeZone, date = new Date()) {
  if (!timeZone) {
    throw new Error('[timezone-helper] Range timezone is required and cannot be empty.');
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;

  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  const minute = parseInt(parts.minute, 10);
  const second = parseInt(parts.second, 10);

  const localDate = new Date(year, month - 1, day, hour, minute, second);

  return {
    timeZone,
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
    formatted: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
    localDate,
  };
}

/**
 * Calculates current range time and target booking time (+hoursOffset).
 * Correctly rolls over date when crossing midnight.
 * @param {string} timeZone - IANA timezone identifier
 * @param {number} [hoursOffset=2] - Hours to add to current range time
 */
function calculateTargetSlotTime(timeZone, hoursOffset = 2) {
  const current = getRangeLocalTime(timeZone);
  const targetLocalDate = new Date(current.localDate.getTime() + hoursOffset * 60 * 60 * 1000);

  const targetYear = targetLocalDate.getFullYear();
  const targetMonth = targetLocalDate.getMonth() + 1;
  const targetDay = targetLocalDate.getDate();
  const targetHour = targetLocalDate.getHours();
  const targetMinute = targetLocalDate.getMinutes();
  const targetSecond = targetLocalDate.getSeconds();

  const target = {
    timeZone,
    year: targetYear,
    month: targetMonth,
    day: targetDay,
    hour: targetHour,
    minute: targetMinute,
    second: targetSecond,
    dateStr: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
    timeStr: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:${String(targetSecond).padStart(2, '0')}`,
    formatted: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')} ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:${String(targetSecond).padStart(2, '0')}`,
    localDate: targetLocalDate,
  };

  return {
    timeZone,
    current,
    target,
  };
}

/**
 * Parses time text from UI or API (e.g. "06:30 AM", "6:30 PM", "14:30:00") into hours and minutes.
 * @param {string} slotStr
 * @returns {{ hour: number, minute: number, totalMinutes: number } | null}
 */
function parseSlotTime(slotStr) {
  if (!slotStr || typeof slotStr !== 'string') return null;

  // 12-hour format with AM/PM (e.g., "06:30 AM")
  const m12 = slotStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = parseInt(m12[2], 10);
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return { hour, minute, totalMinutes: hour * 60 + minute };
  }

  // 24-hour format (e.g., "14:30" or "14:30:00")
  const m24 = slotStr.match(/(\d+):(\d+)/);
  if (m24) {
    const hour = parseInt(m24[1], 10);
    const minute = parseInt(m24[2], 10);
    return { hour, minute, totalMinutes: hour * 60 + minute };
  }

  return null;
}

module.exports = {
  getRangeLocalTime,
  calculateTargetSlotTime,
  parseSlotTime,
};
