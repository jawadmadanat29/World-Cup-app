import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

// Tag shared by the cached read functions in queries.ts (unstable_cache). Busting
// it drops every cached read at once so a mutation is reflected immediately,
// rather than waiting for the per-function revalidate window to lapse.
export const READ_CACHE_TAG = "wcp-read";

/** Revalidate the public + admin trees after a mutation. */
export function revalidateEverything() {
  revalidatePath("/", "layout");
  revalidateTag(READ_CACHE_TAG);
}
