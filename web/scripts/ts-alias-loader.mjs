/**
 * Node register hook: map "@/..." → web/src/...
 * Usage:
 *   node --import ./scripts/ts-alias-loader.mjs --experimental-strip-types scripts/import-prompt-seeds.ts ...
 */
import { register } from "node:module";

register("./ts-alias-hooks.mjs", import.meta.url);
