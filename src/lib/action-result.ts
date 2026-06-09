export interface ActionResult {
  ok: boolean;
  message: string;
}

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });
