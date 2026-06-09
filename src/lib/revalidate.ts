import "server-only";
import { revalidatePath } from "next/cache";

/** Revalidate the public + admin trees after a mutation. */
export function revalidateEverything() {
  revalidatePath("/", "layout");
}
