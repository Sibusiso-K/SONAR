/** @type {import('next').NextConfig} */
const nextConfig = {
  // Everything renders from a JSON file committed to the repo, so the whole
  // site is static. No server, no database, no runtime cost — a push to main
  // triggers a rebuild and the board is live. This is what keeps hosting free.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
