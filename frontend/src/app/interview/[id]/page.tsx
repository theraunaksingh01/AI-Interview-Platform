"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InviteInfo = {
  application_id: string;
  candidate_name: string | null;
  role_title: string;
  seniority: string | null;
  jd_text: string | null;
  rubric_weights: Record<string, any> | null;
  duration_mins: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function InterviewTokenPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function validateToken() {
      setLoading(true);
      setError(null);
      setStatusCode(null);

      try {
        const res = await fetch(`${API_BASE}/api/interview/${id}/validate`, {
          method: "GET",
        });

        if (!res.ok) {
          setStatusCode(res.status);
          const body = await res.json().catch(() => ({}));
          setError(body?.detail || "Unable to validate invite link");
          return;
        }

        const data = (await res.json()) as InviteInfo;
        if (!cancelled) {
          setInvite(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Network error while validating invite link");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    validateToken();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function startInterview() {
    setStarting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/interview/${id}/start`, {
        method: "POST",
      });

      if (!res.ok) {
        setStatusCode(res.status);
        const body = await res.json().catch(() => ({}));
        setError(body?.detail || "Unable to start interview");
        setStarting(false);
        return;
      }

      const data = await res.json();
      const interviewId = data?.interview_id;
      if (!interviewId) {
        setError("Interview session could not be created");
        setStarting(false);
        return;
      }

      router.push(`/interview/${interviewId}/live`);
    } catch (e: any) {
      setError(e?.message || "Network error while starting interview");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Preparing your interview</h1>
        <p className="mt-2 text-gray-600">Validating your invite link...</p>
      </div>
    );
  }

  if (statusCode === 404) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">This link is invalid or has expired</h1>
        <p className="mt-2 text-gray-600">Please contact the recruiter for a new invite link.</p>
      </div>
    );
  }

  if (statusCode === 410) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">You have already completed this interview</h1>
        <p className="mt-2 text-gray-600">This invite link cannot be used again.</p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Unable to load interview</h1>
        <p className="mt-2 text-red-700">{error || "Please try again later."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">Interview Invite</h1>
      <p className="mt-3 text-gray-700">Candidate: {invite.candidate_name || "Candidate"}</p>
      <p className="text-gray-700">Role: {invite.role_title}</p>
      <p className="text-gray-700">Seniority: {invite.seniority || "Not specified"}</p>
      <p className="text-gray-700">Duration: {invite.duration_mins} minutes</p>

      {invite.jd_text ? (
        <div className="mt-4 rounded border bg-white p-4">
          <h2 className="text-lg font-medium">Job Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-gray-700">{invite.jd_text}</p>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-red-700">{error}</p> : null}

      <button
        onClick={startInterview}
        disabled={starting}
        className="mt-6 rounded bg-black px-5 py-3 text-white disabled:opacity-60"
      >
        {starting ? "Starting..." : "Start Interview"}
      </button>
    </div>
  );
}
