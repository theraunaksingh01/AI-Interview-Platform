"use client";

import { useParams } from "next/navigation";
import { InterviewRoom } from "@/app/components/InterviewRoom";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  return <InterviewRoom interviewId={String(params.id)} />;
}