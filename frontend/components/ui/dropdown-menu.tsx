"use client";

import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const DropdownMenu = RadixDropdown.Root;
const DropdownMenuTrigger = RadixDropdown.Trigger;
const DropdownMenuPortal = RadixDropdown.Portal;

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-40 bg-elevated border border-default rounded-md overflow-hidden",
          "shadow-lg py-1",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDropdown.Item>) {
  return (
    <RadixDropdown.Item
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 text-sm text-primary cursor-pointer",
        "hover:bg-hover focus:bg-hover outline-none select-none",
        "data-disabled:opacity-40 data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDropdown.Separator>) {
  return (
    <RadixDropdown.Separator
      className={cn("my-1 h-px bg-default", className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDropdown.Label>) {
  return (
    <RadixDropdown.Label
      className={cn("px-3 py-1.5 text-xs text-secondary font-semibold", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
