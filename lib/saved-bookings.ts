// Bookings a customer made on this device (localStorage, no login needed).

export interface SavedBooking {
  id: string;
  token: string;
  when: string;
  service: string;
}

export const bookingsKey = (slug: string) => `kb:bookings:${slug}`;
