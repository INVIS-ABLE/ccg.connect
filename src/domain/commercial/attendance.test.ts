import { describe, it, expect } from 'vitest';
import { isAttendanceStatus, isOnSite, attendanceSummary } from './attendance';

describe('attendance helpers', () => {
  it('validates statuses', () => {
    expect(isAttendanceStatus('present')).toBe(true);
    expect(isAttendanceStatus('holiday')).toBe(false);
  });
  it('present and late count as on site', () => {
    expect(isOnSite('present')).toBe(true);
    expect(isOnSite('late')).toBe(true);
    expect(isOnSite('absent')).toBe(false);
  });
});

describe('attendanceSummary', () => {
  const expected = ['a', 'b', 'c', 'd'];

  it('counts statuses and unrecorded workers against the expected gang', () => {
    const s = attendanceSummary(
      [
        { worker_id: 'a', status: 'present' },
        { worker_id: 'b', status: 'late' },
        { worker_id: 'c', status: 'absent', replacement_needed: true },
        // d unrecorded
      ],
      expected,
    );
    expect(s).toMatchObject({ expected: 4, present: 1, late: 1, absent: 1, unrecorded: 1, replacementNeeded: 1 });
    expect(s.fillRate).toBe(0.5); // (present + late) / expected = 2/4
  });

  it('ignores records for workers not in the expected gang', () => {
    const s = attendanceSummary([{ worker_id: 'z', status: 'present' }], expected);
    expect(s.present).toBe(0);
    expect(s.unrecorded).toBe(4);
  });

  it('handles an empty expected list', () => {
    expect(attendanceSummary([], []).fillRate).toBe(0);
  });
});
