import path from "node:path";
import { fileURLToPath } from "node:url";
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
];
if (process.env.NODE_ENV === "production")
  headers.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
export default {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.jointoga.com" }],
        destination: "https://jointoga.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers }];
  },
};
