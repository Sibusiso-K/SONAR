/**
 * Organiser logos. Image files live in web/public/org-logos/ and are served
 * from this site, so the page still makes no third-party request.
 *
 * An organiser with no entry here, or whose file fails to load, keeps its
 * initials badge. To add one: put the image in web/public/org-logos/ and add a
 * line below. `match` is tested against the organiser text as the board shows
 * it, so one pattern can cover a long name such as "IBM (via BeMyApp)".
 *
 * Use the organisation's own logo file. Do not draw one.
 */

const LOGO_FILES: { match: RegExp; file: string }[] = [
  // { match: /^Entelect$/i, file: "entelect.png" },
];

export function logoSrc(organiser: string): string | null {
  const hit = LOGO_FILES.find((l) => l.match.test(organiser));
  return hit ? `/org-logos/${hit.file}` : null;
}
