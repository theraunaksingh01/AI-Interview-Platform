type AIDisclaimerProps = {
  variant?: "default" | "compact";
};

export function AIDisclaimer({ variant = "default" }: AIDisclaimerProps) {
  const compact = variant === "compact";

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
          : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
      }
    >
      <p
        className={
          compact
            ? "text-[10px] leading-relaxed text-[#6B7280]"
            : "text-[12px] leading-relaxed text-[#6B7280]"
        }
      >
        AI-generated feedback is for practice and guidance only. It may be imperfect and should not be treated as a final judgment.
      </p>
    </div>
  );
}
