import { existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hooksDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(hooksDir, "..", "src");

function isFile(path) {
    try {
        return existsSync(path) && statSync(path).isFile();
    } catch {
        return false;
    }
}

function tryFile(base) {
    const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, "index.ts"), join(base, "index.js"), base];
    for (const candidate of candidates) {
        if (isFile(candidate)) return candidate;
    }
    return null;
}

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
        const mapped = tryFile(join(srcRoot, specifier.slice(2)));
        if (mapped) return { shortCircuit: true, url: pathToFileURL(mapped).href };
    }

    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
        try {
            const parentPath = fileURLToPath(context.parentURL);
            if (extname(parentPath) === ".ts" || extname(parentPath) === ".tsx") {
                const absolute = pathResolve(dirname(parentPath), specifier);
                if (!extname(specifier)) {
                    const mapped = tryFile(absolute);
                    if (mapped) return { shortCircuit: true, url: pathToFileURL(mapped).href };
                } else if (isFile(absolute)) {
                    return { shortCircuit: true, url: pathToFileURL(absolute).href };
                }
            }
        } catch {
            // fall through
        }
    }

    return nextResolve(specifier, context);
}
