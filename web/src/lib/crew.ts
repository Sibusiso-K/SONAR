/**
 * The two people who run the board, as their Crew tabs present them.
 *
 * `owns` is the default split agreed in docs/TEAM.md. `headline` is copied
 * word for word from each person's LinkedIn. `about` is condensed from their
 * own LinkedIn Experience and Projects entries (read 16 Nov 2026): every fact
 * in it appears there, nothing is inferred. Sibusiso's tab reads as a bench
 * log, Lethabo's as a showcase, matching `voice`.
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
    about: [
      "2020–22  clinical associate. two years writing clinical records at the point of care; knows where that data goes wrong.",
      "2023–25  chair, Wits E-Sports. club & committee of the year 2024.",
      "2026     intern, Isazi.ai. shipped AI Middleman: WhatsApp intent classification, name matching, drafted replies for human approval.",
      "2026     led BobSwarm (3rd, IBM TechXchange Dev Day). backend + models + OR-Tools patrol optimiser for BEACON (top 6, Gradhack).",
      "2026     CivicLens: no model writes a figure; every number quoted from a StatsSA release, re-checked against the PDF.",
    ].join("\n"),
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
    about:
      "Builds the measuring instrument first. At Isazi.ai she benchmarked six text models under three statistical gates and reported the result that went against the project's own hypothesis. On the leaderboard she reverse-engineered Enteland's scoring to the integer, and caught a fabricated gain from label leakage in the WAXAL speech challenge before it shipped. Team lead on BEACON (Top 6 of 50, Discovery Gradhack); 2nd at the Isazi AI Accessibility Hackathon and ITWeb SSHack26.",
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
