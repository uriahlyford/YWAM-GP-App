import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is one of two in the repository, so Turbopack has to be told which
  // directory is the project root — otherwise it picks the repo root and traces
  // files from the sibling app.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  typedRoutes: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pdfkit", "fontkit", "exceljs"],
  // The PDF route reads the Khmer fonts from disk at runtime. Nothing imports
  // them as modules, so the bundler cannot see the dependency and would leave
  // them out of the deployed function.
  outputFileTracingIncludes: {
    "/api/reports/[kind]": ["./src/assets/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Student records must never be framed by another site, sniffed into a
          // different content type, or leak their URL to an external referrer.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
