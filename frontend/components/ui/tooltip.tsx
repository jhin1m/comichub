"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = RadixTooltip.Provider;
const Tooltip = RadixTooltip.Root;
const TooltipTrigger = RadixTooltip.Trigger;

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          "bg-elevated text-primary text-xs px-2 py-1 rounded shadow-lg z-50",
          "select-none",
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
