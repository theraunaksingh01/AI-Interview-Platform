// frontend/src/components/ui/animated-group.tsx
"use client";

import { motion, Variants } from "framer-motion";
import React from "react";

export const AnimatedGroup = ({
  children,
  className,
  variants,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  variants?: {
    container?: Variants;
    item?: Variants;
  } | Variants;
}) => {
  // If caller passes a `variants` object with container/item, we use it accordingly
  const containerVariants: any = (variants && (variants as any).container) || (variants as any);
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedGroup;
