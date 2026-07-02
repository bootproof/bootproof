import fs from "node:fs";
import path from "node:path";
import { TOOL_ID } from "./proof.js";

export type SbomFormat = "cyclonedx-json";

export interface SbomResult {
  schema: "bootproof/sbom-result/v1";
  format: SbomFormat;
  path: string;
  componentCount: number;
  components: Array<{ name: string; version: string; purl: string }>;
}

/**
 * Export a Software Bill of Materials from a repository's dependency manifest.
 * Currently supports npm (package-lock.json) and emits CycloneDX JSON.
 *
 * This is a minimal, honest SBOM: it reads the lockfile that already exists,
 * classifies each dependency as a library component, and emits a CycloneDX
 * document. It does not resolve transitive dependencies that aren't in the
 * lockfile, and it does not claim to — the output states what it found.
 */
export function exportSbom(repoPath: string, format: SbomFormat = "cyclonedx-json"): SbomResult {
  if (format !== "cyclonedx-json") {
    throw new Error(`Unsupported SBOM format: ${format}. Currently supported: cyclonedx-json.`);
  }

  const lockfile = path.join(repoPath, "package-lock.json");
  if (!fs.existsSync(lockfile)) {
    throw new Error(
      `No package-lock.json found at ${repoPath}. SBOM export currently supports npm repositories with a committed lockfile.`,
    );
  }

  const lock = JSON.parse(fs.readFileSync(lockfile, "utf8")) as {
    name?: string;
    version?: string;
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string }>;
  };

  // package-lock.json v2/v3 uses "packages" with keys like "node_modules/express".
  // v1 uses "dependencies" with package names as keys.
  const components: Array<{ name: string; version: string; purl: string }> = [];
  const seen = new Set<string>();

  if (lock.packages) {
    for (const [key, info] of Object.entries(lock.packages)) {
      // Skip the root package (empty string key) and nested node_modules paths
      // (we want the top-level resolved version, not nested dedupes).
      if (key === "") continue;
      const name = key.startsWith("node_modules/") ? key.slice("node_modules/".length) : key;
      // Skip scoped nested paths like node_modules/foo/node_modules/bar
      if (name.includes("node_modules/")) continue;
      if (!info.version) continue;
      const id = `${name}@${info.version}`;
      if (seen.has(id)) continue;
      seen.add(id);
      components.push({
        name,
        version: info.version,
        purl: `pkg:npm/${name}@${info.version}`,
      });
    }
  } else if (lock.dependencies) {
    for (const [name, info] of Object.entries(lock.dependencies)) {
      if (!info.version) continue;
      const id = `${name}@${info.version}`;
      if (seen.has(id)) continue;
      seen.add(id);
      components.push({
        name,
        version: info.version,
        purl: `pkg:npm/${name}@${info.version}`,
      });
    }
  }

  const appName = lock.name ?? path.basename(path.resolve(repoPath));
  const appVersion = lock.version ?? "unknown";

  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: "bootproof", name: "bootproof", version: TOOL_ID.replace(/^bootproof@/, "") }],
      component: {
        type: "application",
        "bom-ref": `pkg:npm/${appName}@${appVersion}`,
        name: appName,
        version: appVersion,
      },
    },
    components: components.map(c => ({
      type: "library",
      "bom-ref": c.purl,
      name: c.name,
      version: c.version,
      purl: c.purl,
    })),
  };

  const outDir = path.join(repoPath, ".bootproof");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "sbom.cdx.json");
  fs.writeFileSync(outFile, JSON.stringify(bom, null, 2) + "\n");

  return {
    schema: "bootproof/sbom-result/v1",
    format,
    path: outFile,
    componentCount: components.length,
    components,
  };
}
