// frontend/src/components/ui/button.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
  className?: string;
};

export function Button({
  asChild = false,
  size = "md",
  variant = "default",
  className,
  children,
  ...rest
}: Props) {
  const sizeCls = size === "lg" ? "px-5 py-3 text-base" : size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2";
  const variantCls =
    variant === "ghost"
      ? "bg-transparent hover:bg-gray-100"
      : variant === "outline"
      ? "bg-white border border-gray-200 hover:bg-gray-50"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  const baseClass = cn("inline-flex items-center justify-center rounded-xl", sizeCls, variantCls);

  // If asChild is true and the child is a valid React element, clone it and inject classes & props.
  if (asChild && React.isValidElement(children)) {
    // Tell TypeScript that child is a React element with any props.
    const child = React.Children.only(children) as React.ReactElement<any, any>;

    // child.props may be 'unknown' by default; cast to any to read child's existing className.
    const childExistingClass = (child.props as any)?.className;

    const childClass = cn(childExistingClass, baseClass, className);

    // cloneElement expects props matching the child's prop types.
    // We cast the merged props to 'any' to avoid TypeScript overload issues.
    return React.cloneElement(child, { ...(rest as any), className: childClass } as any);
  }

  // Default: render a native button and forward props (no asChild)
  return (
    <button {...rest} className={cn(baseClass, className)}>
      {children}
    </button>
  );
}

export default Button;
