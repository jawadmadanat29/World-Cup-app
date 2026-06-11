"use client";
import * as React from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimeZone, TZ_OPTIONS } from "@/components/providers/timezone-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function TimeZoneSwitcher() {
  const { choice, setChoice } = useTimeZone();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change timezone">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Show kickoff times in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TZ_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => setChoice(o.id)}>
            <span className="flex-1">{o.label}</span>
            {choice === o.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
