"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = RadixTabs.Root;

function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("flex border-b border-default", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "px-4 py-2 text-sm text-secondary hover:text-primary transition-colors",
        "border-b-2 border-transparent -mb-px",
        "data-[state=active]:text-accent data-[state=active]:border-accent",
        "focus:outline-none focus-visible:outline-2 focus-visible:outline-accent",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      className={cn("pt-4 focus:outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
