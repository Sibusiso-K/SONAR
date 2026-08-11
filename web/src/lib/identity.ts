import { useEffect, useState } from "react";

/**
 * Attribution only. There is no auth here on purpose — this is a private
 * two-person link. The picker exists so the shared watchlist can say WHO
 * starred something, nothing more. Never treat this value as trusted.
 */
export const CREW = ["Sibusiso", "Lethabo"] as const;
export type CrewMember = (typeof CREW)[number];

const KEY = "sonar.identity";
const EVT = "sonar:identity";

export function readIdentity(): CrewMember | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return CREW.includes(v as CrewMember) ? (v as CrewMember) : null;
}

export function useIdentity() {
  const [identity, setIdentityState] = useState<CrewMember | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIdentityState(readIdentity());
    setHydrated(true);
    const onChange = () => setIdentityState(readIdentity());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setIdentity = (who: CrewMember | null) => {
    if (who) window.localStorage.setItem(KEY, who);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  };

  return { identity, setIdentity, hydrated };
}
