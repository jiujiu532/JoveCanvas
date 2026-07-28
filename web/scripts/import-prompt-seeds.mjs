#!/usr/bin/env node
/**
 * Offline library seed import (Phase2).
 *
 * Usage:
 *   pnpm run import:prompt-seeds -- --source youmind-skill --input <path> --dry-run
 *   pnpm run import:prompt-seeds -- --source gptimage2-json --input <path> --apply
 *
 * Never pass original-author. Apply uses replaceLibrarySeedBatch (independent prefix).
 */
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const srcRoot = join(webRoot, "src");

function printHelp() {
    console.log(`import-prompt-seeds

Required:
  --source youmind-skill|gptimage2-json
  --input <path>                 vendor references dir or prompts.json

Mode (default --dry-run):
  --dry-run                      report only (default)
  --apply                        write via replaceLibrarySeedBatch + rehost covers

Optional:
  --target <n>                   accept cap (default source max)
  --allow-external-cover         keep origin URL if rehost fails (dev only)
  --skip-rehost                  never download covers (dry-run default)
  --help
`);
}

function parseArgs(argv) {
    const out = { dryRun: true, apply: false, allowExternalCover: false, help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") out.help = true;
        else if (arg === "--source") out.source = argv[++i];
        else if (arg === "--input") out.input = argv[++i];
        else if (arg === "--dry-run") {
            out.dryRun = true;
            out.apply = false;
        } else if (arg === "--apply") {
            out.apply = true;
            out.dryRun = false;
        } else if (arg === "--target") out.target = Number(argv[++i]);
        else if (arg === "--allow-external-cover") out.allowExternalCover = true;
        else if (arg === "--skip-rehost") out.skipRehost = true;
        else if (arg === "--no-skip-rehost") out.skipRehost = false;
    }
    return out;
}

async function loadJiti() {
    // Prefer transitive jiti from vitest/vite (not always hoisted as package root dep).
    const require = createRequire(join(webRoot, "package.json"));
    try {
        return require("jiti");
    } catch {
        const pnpmJiti = join(webRoot, "node_modules/.pnpm/jiti@2.7.0/node_modules/jiti/lib/jiti.cjs");
        return require(pnpmJiti);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.source || !args.input) {
        printHelp();
        if (!args.help && (!args.source || !args.input)) process.exitCode = 1;
        return;
    }
    if (args.source !== "youmind-skill" && args.source !== "gptimage2-json") {
        console.error(`Unsupported --source ${args.source}`);
        process.exitCode = 1;
        return;
    }

    const createJiti = await loadJiti();
    const jiti = createJiti(join(webRoot, "scripts"), {
        interopDefault: true,
        alias: {
            "@": srcRoot,
        },
    });

    const { runSeedImport, SEED_SOURCE_META, cleanupUnreferencedPromptSeedCovers } = jiti(join(srcRoot, "lib/prompts/seed-import/index.ts"));
    const { isLibrarySeedSourceRegistered, listAllLibraryPromptsForImport, replaceLibrarySeedBatch } = jiti(join(srcRoot, "lib/prompts/store.ts"));

    if (!(args.source in SEED_SOURCE_META)) {
        console.error("Unknown source");
        process.exitCode = 1;
        return;
    }

    const inputPath = resolve(args.input);
    const meta = SEED_SOURCE_META[args.source];

    // Without DATABASE_URL, postgres mode cannot read/write. File provider can still apply to local JSON.
    const hasPostgresUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
    const provider = (process.env.VOZEB_PRO_DATABASE_PROVIDER || "").toLowerCase();
    const isFileProvider = provider === "file";
    if (!hasPostgresUrl) {
        if (args.apply && !isFileProvider) {
            console.error("[import] apply requires DATABASE_URL/POSTGRES_URL, or VOZEB_PRO_DATABASE_PROVIDER=file");
            process.exitCode = 1;
            return;
        }
        if (!isFileProvider) {
            process.env.VOZEB_PRO_DATABASE_PROVIDER = "file";
            console.warn("[import] no DATABASE_URL — forced file provider for dry-run baseline");
        }
    }

    // Apply path: if this exact versioned source is already registered, skip before any rehost download.
    if (args.apply) {
        try {
            const alreadyRegistered = await isLibrarySeedSourceRegistered(meta.source);
            if (alreadyRegistered) {
                console.log(`[import] skipped (source already registered) source=${meta.source}`);
                return;
            }
        } catch (error) {
            console.error(`[import] failed to check seed source registration: ${error instanceof Error ? error.message : error}`);
            process.exitCode = 1;
            return;
        }
    }

    let library = [];
    try {
        library = await listAllLibraryPromptsForImport();
    } catch (error) {
        if (args.apply) throw error;
        console.warn(`[import] library read failed (${error instanceof Error ? error.message : error}); dry-run continues with empty baseline`);
        library = [];
    }
    console.log(`[import] library size=${library.length} source=${args.source} input=${inputPath} mode=${args.apply ? "apply" : "dry-run"}`);

    const report = await runSeedImport({
        sourceKey: args.source,
        inputPath,
        library,
        target: Number.isFinite(args.target) ? args.target : undefined,
        dryRun: !args.apply,
        allowExternalCover: args.allowExternalCover,
        skipRehost: args.skipRehost ?? !args.apply,
        // Apply path: re-check registration before rehost (CLI already checked once above).
        skipIfSourceRegistered: Boolean(args.apply),
    });

    if (args.apply && report.skipped?.source_registered) {
        console.log(`[import] skipped (source already registered) source=${report.source}`);
        return;
    }

    console.log(
        JSON.stringify(
            {
                source: report.source,
                scanned: report.scanned,
                accepted: report.accepted,
                skipped: report.skipped,
                sceneCounts: report.sceneCounts,
                localeCounts: report.localeCounts,
                samples: report.samples,
            },
            null,
            2,
        ),
    );

    if (!args.apply) {
        console.log("[import] dry-run complete (no writes)");
        return;
    }

    if (!report.prompts.length) {
        console.error("[import] nothing to apply");
        process.exitCode = 1;
        return;
    }

    const result = await replaceLibrarySeedBatch({
        sourcePrefix: report.sourcePrefix,
        source: report.source,
        prompts: report.prompts,
    });
    if (result.skipped) {
        // Race after rehost: batch claim lost. Drop unreferenced covers produced by this run.
        const tokens = Array.isArray(report.rehostedTokens) ? report.rehostedTokens : [];
        console.warn(
            `[import] skipped after apply race (source already registered) source=${report.source} rehostedTokens=${tokens.length}`,
        );
        if (tokens.length) {
            try {
                const cleanup = await cleanupUnreferencedPromptSeedCovers(tokens);
                console.log(
                    `[import] orphan cover cleanup deleted=${cleanup.deleted} blocked=${cleanup.blocked} candidates=${tokens.length}`,
                );
            } catch (error) {
                console.warn(
                    `[import] orphan cover cleanup failed: ${error instanceof Error ? error.message : error}`,
                );
            }
        }
        return;
    }
    console.log(`[import] applied written=${result.written} source=${report.source}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
