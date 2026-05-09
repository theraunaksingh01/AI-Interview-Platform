"use client";

import React from "react";
import { motion } from "framer-motion";

const colleges = [
  "IIT Bombay", "IIIT Hyderabad", "VIT Vellore", "BITS Pilani",
  "DTU Delhi", "SRM Chennai", "NIT Trichy", "Amity University",
  "Bennett University", "Manipal", "NSUT", "Lovely Professional",
  "IIT Bombay", "IIIT Hyderabad", "VIT Vellore", "BITS Pilani",
  "DTU Delhi", "SRM Chennai", "NIT Trichy", "Amity University",
  "Bennett University", "Manipal", "NSUT", "Lovely Professional",
];

export function SocialProof() {
  return (
    <section
      className="py-5 overflow-hidden"
      style={{
        background: "#F5F5F0",
        borderTop: "1px solid #E8E8E0",
        borderBottom: "1px solid #E8E8E0",
      }}
    >
      <div className="flex items-center gap-6 px-6 mb-3">
        <p
          className="whitespace-nowrap flex-shrink-0"
          style={{ fontSize: "12px", color: "#999", fontWeight: 500 }}
        >
          Students from
        </p>
        <div
          style={{
            height: "1px",
            background: "#E8E8E0",
            flex: 1,
          }}
        />
      </div>

      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-12 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ width: "max-content" }}
        >
          {colleges.map((college, i) => (
            <span
              key={i}
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#BBBBBB",
                whiteSpace: "nowrap",
                letterSpacing: "-0.2px",
              }}
            >
              {college}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}