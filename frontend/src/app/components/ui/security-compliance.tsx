import { ShieldCheck, Lock, FileCheck, Brain } from "lucide-react";

export default function SecurityCompliance() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Enterprise Security",
      desc: "End-to-end encryption ensures interviews and candidate data remain secure.",
    },
    {
      icon: FileCheck,
      title: "Global Compliance",
      desc: "We follow GDPR, SOC 2, and global hiring standards for peace of mind.",
    },
    {
      icon: Brain,
      title: "Fair AI",
      desc: "Bias-aware algorithms with transparent scoring for every candidate.",
    },
    {
      icon: Lock,
      title: "Private by Design",
      desc: "Only your team can access recordings, transcripts, and reports.",
    },
  ];

  return (
    <section className="full-bleed bg-muted/40 py-16 md:py-24">
      <div className="bleed-inner">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Security & Compliance
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Built for enterprises, trusted by startups — we keep your interview
            data safe, fair, and private.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-background p-8 border border-border shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/60"
            >
              <div className="flex flex-col items-center justify-center text-center">
                <item.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
