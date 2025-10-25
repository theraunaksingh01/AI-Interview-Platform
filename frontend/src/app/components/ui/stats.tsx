// frontend/src/components/ui/stats.tsx

type Stat = { value: string; label: string }

interface StatsSectionProps {
  stats?: Stat[]   // we will render ONLY the first 2
  blurb?: string
  id?: string
}

const DEFAULT_STATS: Stat[] = [
  { value: "90+", label: "Integrations" },
  { value: "56%", label: "Productivity Boost" },
]

const DEFAULT_BLURB =
  "Our platform continues to grow with hiring teams and developers. AI-assisted interviews standardize questions, automate scoring, and cut review time — helping you make faster, fairer, and more confident hiring decisions."

export default function StatsSection({
  stats = DEFAULT_STATS,
  blurb = DEFAULT_BLURB,
  id,
}: StatsSectionProps) {
  const two = stats.slice(0, 2) // <<< ensure exactly two columns on the left

  return (
    <section id={id} className=" full-bleed py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="sr-only">Product stats</h2>

        {/* One row: col1=stat, col2=stat, col3-4=blurb */}
        <div className="grid items-center gap-8 md:gap-10 md:grid-cols-4">
          {two.map((s, i) => (
            <div key={i} className="space-y-1 md:text-center">
              <div className="text-foreground text-3xl md:text-4xl font-bold tracking-tight">
                {s.value}
              </div>
              <p className="text-muted-foreground text-base">
                {s.label}
              </p>
            </div>
          ))}

          {/* Right side paragraph spans 2 columns on md+ */}
          <div className="col-span-2 border-t pt-5 md:col-span-2 md:border-t-0 md:border-l md:pl-10">
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed">
              {blurb}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
