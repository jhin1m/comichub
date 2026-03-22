"use client";

import * as RadixAvatar from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: { root: "w-8 h-8", fallbackText: "text-xs" },
  md: { root: "w-10 h-10", fallbackText: "text-sm" },
  lg: { root: "w-20 h-20", fallbackText: "text-lg" },
};

interface AvatarProps {
  src?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function Avatar({ src, fallback, size = "md", className }: AvatarProps) {
  const { root, fallbackText } = sizeClasses[size];

  return (
    <RadixAvatar.Root
      className={cn("relative flex shrink-0 overflow-hidden rounded-full", root, className)}
    >
      {src && (
        <RadixAvatar.Image
          src={src}
          className="w-full h-full object-cover rounded-full"
          alt={fallback ?? "avatar"}
        />
      )}
      <RadixAvatar.Fallback
        className={cn(
          "w-full h-full rounded-full bg-elevated text-secondary",
          "flex items-center justify-center font-semibold uppercase",
          fallbackText,
        )}
        delayMs={src ? 300 : 0}
      >
        {fallback ? fallback.slice(0, 2) : "?"}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

export { Avatar };
