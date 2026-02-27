/**
 * Active cities used for onboarding and location selection.
 * Replace with a cities table or API when needed.
 */
export const ACTIVE_CITIES = [
  "Dallas",
  "Carrollton",
  "Plano",
  "Frisco",
  "Coppell",
] as const;

export type ActiveCity = (typeof ACTIVE_CITIES)[number];
