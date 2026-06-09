"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export function ActionButton({
  action,
  children,
  pendingLabel = "Working…",
  confirm,
  ...props
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel?: string;
  confirm?: string;
} & Omit<ButtonProps, "onClick">) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          res.ok ? toast.success(res.message) : toast.error(res.message);
        });
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
