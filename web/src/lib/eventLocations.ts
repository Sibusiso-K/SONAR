/**
 * Where each opportunity actually happens, for the globe on Radar.
 *
 * "venue" = a real, stated venue/city (from data/opportunities.json's
 * `location` field) — high confidence, shown as a solid marker.
 * "hq" = no physical event location exists (fully online); pinned at the
 * organiser's known HQ city instead, as a reference point, not a claim
 * about where the event happens — shown as a hollow marker and labelled
 * "online" in the tooltip. Never guess a city we're not confident about;
 * omit rather than fabricate, same rule the rest of the board follows.
 */
export type EventLocation = {
  lat: number;
  lng: number;
  city: string;
  country: string;
  kind: "venue" | "hq";
};

export const EVENT_LOCATIONS: Record<string, EventLocation> = {
  "bcg-platinion-2026": { lat: -26.2041, lng: 28.0473, city: "Johannesburg", country: "South Africa", kind: "venue" },
  "govtech-2026": { lat: -29.8587, lng: 31.0218, city: "Durban", country: "South Africa", kind: "venue" },
  "fnb-aoty-2026": { lat: -26.2041, lng: 28.0473, city: "Johannesburg", country: "South Africa", kind: "venue" },
  "unesco-youth-2026": { lat: 40.6401, lng: 22.9444, city: "Thessaloniki", country: "Greece", kind: "venue" },
  "entelect-university-cup-2027": { lat: -26.2041, lng: 28.0473, city: "Johannesburg", country: "South Africa", kind: "venue" },
  "geekulcha-2026": { lat: -25.7479, lng: 28.2293, city: "Pretoria", country: "South Africa", kind: "venue" },
  "mintek-sci-2026": { lat: -26.0936, lng: 28.0064, city: "Randburg", country: "South Africa", kind: "venue" },

  "mtn-momo-miniapp-2026": { lat: -26.2041, lng: 28.0473, city: "Johannesburg", country: "South Africa", kind: "hq" },
  "zindi-rolling": { lat: -33.9249, lng: 18.4241, city: "Cape Town", country: "South Africa", kind: "hq" },
  "huawei-ict-2026-2027": { lat: -26.2041, lng: 28.0473, city: "Johannesburg", country: "South Africa", kind: "hq" },
  "ibm-devday-bob-2026": { lat: 41.1004, lng: -73.7245, city: "Armonk, NY", country: "United States", kind: "hq" },
  "ibm-z-datathon-2026": { lat: 41.1004, lng: -73.7245, city: "Armonk, NY", country: "United States", kind: "hq" },
  "rsna-knee-2026": { lat: 41.8781, lng: -87.6298, city: "Chicago", country: "United States", kind: "hq" },
  "nasa-space-apps-2026": { lat: 38.8894, lng: -77.0353, city: "Washington, D.C.", country: "United States", kind: "hq" },

  // No confident location — fully global/online with no stated host city
  // or established HQ we're sure of. Omitted rather than guessed:
  // adtc-2026, shipaton-2026
};
