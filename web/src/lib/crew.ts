/**
 * The two people who run the board, as their Crew tabs present them.
 *
 * `owns` is the default split agreed in docs/TEAM.md. `headline` and `about`
 * are each person's own words and are empty until they supply them: the page
 * shows nothing in their place, never a guess at someone's career.
 */

import type { CrewMember } from "@/lib/identity";

export type CrewProfile = {
  id: CrewMember;
  fullName: string;
  initials: string;
  /** One line under the name, in the person's own words. */
  headline: string;
  about: string;
  /** The short line above the name. */
  strap: string;
  owns: string[];
  links: { label: string; href: string }[];
  /** How the tab is set: a bench log, or a showcase. */
  voice: "bench" | "showcase";
};

export const CREW_PROFILES: Record<CrewMember, CrewProfile> = {
  Sibusiso: {
    id: "Sibusiso",
    fullName: "Sibusiso Khumalo",
    initials: "SK",
    headline:
      "AI Engineer & Full-Stack Developer | Python · FastAPI · Multi-Agent Systems · Azure | 3rd Place IBM Bob 2.0 Hackathon · Top 6 Discovery Gradhack | Ex-Clinician | Wits Electrical Engineering",
    about: "",
    strap: "systems, models, deadlines",
    owns: [
      "Model, core algorithm, backend",
      "Benchmarking and profiling harness",
      "Submission mechanics, deadline watch",
      "Registrations, forms, credentials",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/Sibusiso-K" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/sibusiso-khumalo-00520a201/" },
    ],
    voice: "bench",
  },
  Lethabo: {
    id: "Lethabo",
    fullName: "Lethabo Hoaeane",
    initials: "LH",
    headline:
      "Data Science & AI Engineering | Multi-agent LLM systems · ML · Optimisation | 3× hackathon winner: Isazi AI, ITWeb Security Summit, IBM TechXchange | Final-year BCom Business Informatics, UNISA",
    about: "",
    strap: "App, story, demo",
    owns: [
      "App layer, UI, integration",
      "Written report and README",
      "Demo video: storyboard, record, cut",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/LethaboMH14" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/lethabo-hoaeane-54a84a36b/" },
    ],
    voice: "showcase",
  },
};
