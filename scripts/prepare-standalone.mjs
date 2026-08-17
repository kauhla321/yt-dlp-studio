// Post-build step for the Electron package.
//
// `next build` with output:"standalone" produces .next/standalone/server.js
// plus a traced node_modules, but it does NOT copy the static assets or the
// public/ folder. The standalone server expects them at .next/standalone/.next/static
// and .next/standalone/public, so copy them into place here.

import { cp, access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyInto(src, dest, label) {
  if (!(await exists(src))) {
    console.warn(`[prepare-standalone] skip ${label}: ${src} not found`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`[prepare-standalone] copied ${label}`);
}

async function main() {
  if (!(await exists(standalone))) {
    console.error(
      "[prepare-standalone] .next/standalone not found. Run `next build` with output:'standalone' first."
    );
    process.exit(1);
  }

  await copyInto(
    path.join(root, ".next", "static"),
    path.join(standalone, ".next", "static"),
    ".next/static"
  );
  await copyInto(path.join(root, "public"), path.join(standalone, "public"), "public");

  console.log("[prepare-standalone] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
