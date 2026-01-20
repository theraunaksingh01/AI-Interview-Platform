"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ReplayEvent = {
  timestamp: string;
  type: string;
  question_id?: number;
  payload: any;
};

export default function InterviewReplayPage() {
  const { id } = useParams();
  const interviewId = id as string;

  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/api/interview/${interviewId}/replay`
    )
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) {
    return <div className="p-6">Loading replay…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-xl font-semibold mb-4">
        Interview Replay
      </h1>

      <div className="space-y-4">
        {events.map((e, i) => (
          <ReplayEventCard key={i} event={e} />
        ))}
      </div>
    </div>
  );
}

function ReplayEventCard({ event }: { event: ReplayEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  switch (event.type) {
    case "agent_message":
      return (
        <Card label="AI Interviewer" time={time}>
          {event.payload.text}
        </Card>
      );

    case "candidate_answer":
      return (
        <Card label="Candidate" time={time} variant="candidate">
          {event.payload.transcript}
        </Card>
      );

    case "live_signal":
      return (
        <Card label="Live Signal" time={time} variant="signal">
          Confidence:{" "}
          <strong>{event.payload.confidence}</strong>
          <br />
          Words: {event.payload.word_count}
        </Card>
      );

    case "turn_decision":
      return (
        <Card label="AI Decision" time={time} variant="decision">
          Decision:{" "}
          <strong>{event.payload.decision}</strong>
        </Card>
      );

    default:
      return null;
  }
}

function Card({
  label,
  time,
  children,
  variant = "default",
}: {
  label: string;
  time: string;
  children: React.ReactNode;
  variant?: "default" | "candidate" | "signal" | "decision";
}) {
  const colors = {
    default: "bg-white",
    candidate: "bg-blue-50",
    signal: "bg-yellow-50",
    decision: "bg-green-50",
  };

  return (
    <div
      className={`rounded-lg p-4 shadow ${colors[variant]}`}
    >
      <div className="text-xs text-gray-500 mb-1">
        {label} • {time}
      </div>
      <div className="text-sm text-gray-900">
        {children}
      </div>
    </div>
  );
}
