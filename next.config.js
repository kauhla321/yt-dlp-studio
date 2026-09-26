/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the dev-mode route indicator badge (the "N" in the bottom-left corner).
  devIndicators: false,
  // Emit a self-contained server (.next/standalone/server.js) so the Electron
  // shell can run it as a child process without the full node_modules tree.
  output: "standalone",
  // Security headers for the local web UI. The CSP keeps remote content to
  // images only (thumbnails), 'self' for everything else, and blocks framing.
  // Next's dev-mode client runtime (HMR/React Refresh) evaluates code via
  // `eval`, so 'unsafe-eval' is only added outside production builds.
  async headers() {
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
