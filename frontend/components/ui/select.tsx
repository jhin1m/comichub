"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = RadixSelect.Root;
const SelectValue = RadixSelect.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>) {
  return (
    <RadixSelect.Trigger
      className={cn(
        "h-10 bg-elevated border border-default rounded-md px-3",
        "text-primary text-sm flex items-center justify-between gap-2",
        "hover:bg-hover focus:outline-none focus:border-accent",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown size={14} className="text-secondary shrink-0" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "bg-elevated border border-default rounded-md overflow-hidden z-50",
          "shadow-lg min-w-[var(--radix-select-trigger-width)]",
          className,
        )}
        {...props}
      >
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        "px-3 py-2 text-sm text-primary cursor-pointer",
        "hover:bg-hover focus:bg-hover outline-none",
        "data-[state=checked]:text-accent",
        "select-none",
        className,
      )}
      {...props}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
