"use client";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] px-8 py-14 text-[#111]">
      <div className="mx-auto max-w-[1000px]">
        <header className="mb-10 text-center">
          <h1 className="text-[34px] font-bold">Simple, honest pricing</h1>
          <p className="mt-2 text-[15px] text-[#6B7280]">Start free. Upgrade when you're ready.</p>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-7">
            <h2 className="text-2xl font-bold">Free</h2>
            <p className="mt-1 text-[30px] font-bold text-[#111]">₹0<span className="text-base font-medium text-[#6B7280]">/month</span></p>

            <ul className="mt-6 space-y-2 text-sm">
              <li>✓ 1 mock interview per month</li>
              <li>✓ Basic score after interview</li>
              <li>✓ Question variety (DSA, behavioral, system design)</li>
              <li className="text-[#9CA3AF]">✗ Detailed communication report</li>
              <li className="text-[#9CA3AF]">✗ WPM and filler analysis</li>
              <li className="text-[#9CA3AF]">✗ STAR scoring</li>
              <li className="text-[#9CA3AF]">✗ Progress dashboard</li>
              <li className="text-[#9CA3AF]">✗ Unlimited sessions</li>
            </ul>

            <button disabled className="mt-7 w-full cursor-not-allowed rounded-lg border border-[#E5E7EB] bg-[#F3F4F6] px-4 py-3 text-sm font-semibold text-[#9CA3AF]">
              Current Plan
            </button>
          </div>

          <div className="relative rounded-2xl border-2 border-[#6366F1] bg-white p-7 shadow-sm">
            <div className="absolute -top-3 right-6 rounded-full bg-[#6366F1] px-3 py-1 text-xs font-semibold text-white">
              Most Popular
            </div>

            <h2 className="text-2xl font-bold">Pro</h2>
            <p className="mt-1 text-[30px] font-bold text-[#111]">₹299<span className="text-base font-medium text-[#6B7280]">/month</span></p>

            <ul className="mt-6 space-y-2 text-sm">
              <li>✓ Unlimited mock interviews</li>
              <li>✓ Full communication report</li>
              <li>✓ WPM and filler word analysis</li>
              <li>✓ STAR method scoring</li>
              <li>✓ Progress dashboard with trends</li>
              <li>✓ Live coaching overlay</li>
              <li>✓ Code hints during practice</li>
              <li>✓ Skill passport (coming soon)</li>
            </ul>

            <button className="mt-7 w-full rounded-lg bg-[#6366F1] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5558e7]">
              Upgrade to Pro
            </button>
            <p className="mt-3 text-center text-xs text-[#9CA3AF]">Razorpay payment coming soon</p>
          </div>
        </section>
      </div>
    </main>
  );
}
