/**
 * Booking-conflict detection for the team resource view.
 *
 * Pure and date-string based (ISO `yyyy-mm-dd`, which sorts/compares
 * lexicographically) so it is trivially testable and has no timezone surprises.
 * A "booking" is one contractor's assignment occupying an inclusive day range.
 */
export interface Booking {
  id: string;
  contractor_id: string;
  /** Inclusive start day, ISO `yyyy-mm-dd`. */
  start: string;
  /** Inclusive finish day, ISO `yyyy-mm-dd`; must be >= start. */
  finish: string;
}

/** Two inclusive day ranges overlap when each starts on or before the other ends. */
export function rangesOverlap(aStart: string, aFinish: string, bStart: string, bFinish: string): boolean {
  return aStart <= bFinish && bStart <= aFinish;
}

/**
 * Ids of bookings that clash with at least one other booking for the SAME
 * contractor (a double-booking). Bookings for different contractors never clash.
 */
export function findConflictingBookingIds(bookings: readonly Booking[]): Set<string> {
  const conflicting = new Set<string>();
  const byContractor = new Map<string, Booking[]>();
  for (const b of bookings) {
    const list = byContractor.get(b.contractor_id) ?? [];
    list.push(b);
    byContractor.set(b.contractor_id, list);
  }
  for (const list of byContractor.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (rangesOverlap(a.start, a.finish, b.start, b.finish)) {
          conflicting.add(a.id);
          conflicting.add(b.id);
        }
      }
    }
  }
  return conflicting;
}
