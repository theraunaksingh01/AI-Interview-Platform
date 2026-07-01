"use client";

import Image from "next/image";

const steps = [
  {
    step: "Step 1",
    title: "Pick your company",
    description:
      "Select your target company, role, and difficulty. Qued pulls real questions from that company's campus placement history.",
    image: "/images/how-it-works-1.png",
  },
  {
    step: "Step 2",
    title: "Answer by voice",
    description:
      "Speak your answers like a real interview. Live coaching tracks your pace, fillers, and silence in real-time.",
    image: "/images/how-it-works-2.png",
  },
  {
    step: "Step 3",
    title: "See what to fix",
    description:
      "Get scored on every answer. See the model answer, what you missed, and one specific thing to improve.",
    image: "/images/how-it-works-3.png",
  },
];

const features = [
  {
    emoji: "🏢",
    text: "Real campus placement questions",
  },
  {
    emoji: "🎤",
    text: "Live voice coaching",
  },
  {
    emoji: "📊",
    text: "Instant scoring + model answers",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6">

        {/* Small Heading */}

        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-blue-500">
            // Start in less than 15 minutes
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-black md:text-5xl">
            Here's how it works
          </h2>
        </div>

        {/* Cards */}

        <div className="mt-20 grid overflow-hidden rounded-xl border border-gray-200 md:grid-cols-3">

          {steps.map((item, index) => (
            <div
              key={index}
              className={`bg-white p-8 ${
                index !== steps.length - 1
                  ? "border-b md:border-b-0 md:border-r border-gray-200"
                  : ""
              }`}
            >
              {/* Image */}

              <div className="relative h-52 overflow-hidden rounded-2xl bg-neutral-900">

                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover"
                />

                {/* Placeholder if image doesn't exist */}

                <div className="absolute inset-0 flex items-center justify-center text-white/40 text-lg font-semibold">
                  Replace Image
                </div>
              </div>

              {/* Step */}

              <div className="mt-7 inline-flex rounded-md bg-lime-300 px-3 py-1 text-sm font-semibold text-black">
                {item.step}
              </div>

              {/* Title */}

              <h3 className="mt-5 text-2xl font-semibold text-black">
                {item.title}
              </h3>

              {/* Description */}

              <p className="mt-3 text-[15px] leading-7 text-neutral-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Feature Bar */}

        <div className="mt-16 flex justify-center">

          <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-gray-200 bg-white px-8 py-5 shadow-sm">

            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-sm font-medium text-gray-700"
              >
                <span className="text-xl">{feature.emoji}</span>

                <span>{feature.text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}