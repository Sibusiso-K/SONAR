import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SONAR — opportunity board",
    short_name: "SONAR",
    description:
      "Hackathons, competitions, graduate programmes and recruiting events — found, verified and scheduled automatically.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1014",
    theme_color: "#0e6e75",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
