// src/components/ui/cards-stack.tsx
"use client"

import * as React from "react"
import { HTMLMotionProps, motion } from "motion/react"
import { cn } from "@/lib/utils"

interface CardStickyProps extends HTMLMotionProps<"div"> {
  index: number
  incrementY?: number
  incrementZ?: number
}

export const ContainerScroll = React.forwardRef<
  HTMLDivElement,
  React.HTMLProps<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("relative w-full", className)}
      {...props}
    >
      {children}
    </div>
  )
})
ContainerScroll.displayName = "ContainerScroll"

export const CardSticky = React.forwardRef<HTMLDivElement, CardStickyProps>(
  (
    {
      index,
      incrementY = 160,      // << spacing between pinned cards (adjust freely)
      incrementZ = 2,         // << z-index step
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const top = index * incrementY
    const zIndex = 10 + index * incrementZ

    return (
      <motion.div
        ref={ref}
        style={{
          top,
          zIndex,                        // << IMPORTANT: use zIndex (not "z")
          backfaceVisibility: "hidden",
          willChange: "transform, top",
          ...style,
        }}
        className={cn("sticky", className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
CardSticky.displayName = "CardSticky"
