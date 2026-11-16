/**
 * Organiser logos. Image files live in web/public/org-logos/ and are served
 * from this site, so the page still makes no third-party request. Where each
 * file came from is recorded in web/public/org-logos/SOURCES.md.
 *
 * An organiser with no entry here, or whose file fails to load, keeps its
 * initials badge. To add one: put the image in web/public/org-logos/ (a PNG,
 * not an SVG, so the file cannot carry a script), record its source, and add
 * a line below. `match` is tested against the organiser text as the board
 * shows it, so one pattern covers a long name such as "IBM (via BeMyApp)".
 *
 * Use the organisation's own logo file. Do not draw one.
 */

export const LOGO_FILES: readonly { match: RegExp; file: string }[] = [
  { match: /^Anthropic$/, file: "anthropic.png" },
  { match: /^Atlassian\b/, file: "atlassian.png" },
  { match: /^AWS\b/, file: "aws.png" },
  { match: /^BCG Platinion\b/, file: "bcg-platinion.png" },
  { match: /^Entelect\b/, file: "entelect.png" },
  { match: /^FNB\b/, file: "fnb.png" },
  { match: /^Gates Foundation\b/, file: "gates.png" },
  { match: /^Geekulcha\b/, file: "geekulcha.png" },
  { match: /^GitLab\b/, file: "gitlab.png" },
  { match: /^Google DeepMind\b/, file: "google-deepmind.png" },
  { match: /^IBM\b/, file: "ibm.png" },
  { match: /^Kiro\b/, file: "kiro.png" },
  { match: /^Kisaco Research \+ lablab\.ai\b/, file: "lablab.png" },
  { match: /^Melsoft\b/, file: "melsoft.png" },
  { match: /^Meta\b/, file: "meta.png" },
  { match: /^micro1\b/, file: "micro1.png" },
  { match: /^Microsoft$/, file: "microsoft.png" },
  { match: /^Mintek$/, file: "mintek.png" },
  { match: /^MTN\b/, file: "mtn.png" },
  { match: /^NASA\b/, file: "nasa.png" },
  { match: /^Nebius\b/, file: "nebius.png" },
  { match: /^Nedbank$/, file: "nedbank.png" },
  { match: /^PayPal\b/, file: "paypal.png" },
  { match: /^Qloo\b/, file: "qloo.png" },
  { match: /^Radiological Society of North America\b/, file: "rsna.png" },
  { match: /^RevenueCat$/, file: "revenuecat.png" },
  { match: /^Tony Elumelu Foundation$/, file: "tef.png" },
  { match: /^UNESCO$/, file: "unesco.png" },
  { match: /^W3Node$/, file: "w3node.png" },
  { match: /^World Bank\b/, file: "world-bank.png" },
  { match: /^Zindi\b/, file: "zindi.png" },
];

export function logoSrc(organiser: string): string | null {
  const hit = LOGO_FILES.find((l) => l.match.test(organiser));
  return hit ? `/org-logos/${hit.file}` : null;
}
