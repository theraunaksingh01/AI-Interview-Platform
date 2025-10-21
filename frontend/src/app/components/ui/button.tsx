// frontend/src/components/ui/button.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean; // if using asChild pattern we keep simple for now
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
};

export function Button({ children, className, size = "md", variant = "default", ...props }: Props) {
  const sizeCls = size === "lg" ? "px-5 py-3 text-base" : size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2";
  const variantCls =
    variant === "ghost"
      ? "bg-transparent hover:bg-gray-100"
      : variant === "outline"
      ? "bg-white border border-gray-200 hover:bg-gray-50"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  return (
    <button {...props} className={cn("inline-flex items-center justify-center rounded-xl", sizeCls, variantCls, className)}>
      {children}
    </button>
  );
}
