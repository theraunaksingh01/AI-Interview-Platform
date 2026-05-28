"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Plan = "free" | "pro" | "max";
type SectionKey = "profile" | "account" | "plan" | "privacy";

type MeResponse = {
  id: number;
  email: string;
  full_name: string | null;
  college?: string | null;
  year_of_study?: string | null;
  branch?: string | null;
  is_active: boolean;
  is_superuser: boolean;
  roles: string[];
  plan?: Plan;
  onboarding_done?: boolean;
  target_roles?: string[];
  self_level?: string | null;
  placement_goal?: string | null;
  target_companies?: string[];
  linkedin_url?: string | null;
  github_url?: string | null;
};

type NotificationPrefs = {
  sessionReminders: boolean;
  dailyQuestionReminder: boolean;
  weeklyProgressReport: boolean;
};

type ProfileForm = {
  fullName: string;
  email: string;
  college: string;
  yearOfStudy: string;
  branch: string;
  targetCompanies: string[];
  linkedinUrl: string;
  githubUrl: string;
};

const SECTIONS: { id: SectionKey; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "plan", label: "Plan & Usage" },
  { id: "privacy", label: "Privacy & Notifications" },
];

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduated"];
const BRANCH_OPTIONS = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "Other"];
const COMPANY_OPTIONS = ["TCS", "Infosys", "Wipro", "Accenture", "Amazon", "Microsoft", "Google", "Startup", "Other"];

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  sessionReminders: true,
  dailyQuestionReminder: false,
  weeklyProgressReport: true,
};

const NOTIFICATION_ITEMS: Array<{ key: keyof NotificationPrefs; label: string; hint: string }> = [
  { key: "sessionReminders", label: "Session reminders", hint: "Email" },
  { key: "dailyQuestionReminder", label: "Daily question reminder", hint: "Email" },
  { key: "weeklyProgressReport", label: "Weekly progress report", hint: "Email" },
];

function planBadgeClass(plan: Plan) {
  if (plan === "max") return "bg-[#FFD600] text-black";
  if (plan === "pro") return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function nextTier(plan: Plan): { name: string; price: string } | null {
  if (plan === "free") return { name: "Pro", price: "₹149/month" };
  if (plan === "pro") return { name: "Max", price: "₹299/month" };
  return null;
}

function getInitials(fullName: string, email: string) {
  const source = fullName.trim() || email.trim() || "U";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [plan, setPlan] = useState<Plan>("free");
  const [profile, setProfile] = useState<ProfileForm>({
    fullName: "",
    email: "",
    college: "",
    yearOfStudy: "",
    branch: "",
    targetCompanies: [],
    linkedinUrl: "",
    githubUrl: "",
  });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);

  useEffect(() => {
    const raw = localStorage.getItem("settings_notifications");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...parsed });
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("settings_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      setLoading(true);
      setLoadingError(null);
      try {
        const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
        const res = await fetch("/api/auth/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          throw new Error("Unable to load settings");
        }
        const data = (await res.json()) as MeResponse;
        if (cancelled) return;
        setPlan((data.plan ?? "free") as Plan);
        setProfile({
          fullName: data.full_name ?? "",
          email: data.email ?? "",
          college: data.college ?? "",
          yearOfStudy: data.year_of_study ?? "",
          branch: data.branch ?? "",
          targetCompanies: Array.isArray(data.target_companies) ? data.target_companies : [],
          linkedinUrl: data.linkedin_url ?? "",
          githubUrl: data.github_url ?? "",
        });
      } catch (error) {
        if (!cancelled) {
          setLoadingError(error instanceof Error ? error.message : "Unable to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  function updateProfileField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCompany(company: string) {
    setProfile((prev) => ({
      ...prev,
      targetCompanies: prev.targetCompanies.includes(company)
        ? prev.targetCompanies.filter((item) => item !== company)
        : [...prev.targetCompanies, company],
    }));
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: profile.fullName,
          college: profile.college,
          year_of_study: profile.yearOfStudy,
          branch: profile.branch,
          target_companies: profile.targetCompanies,
          linkedin_url: profile.linkedinUrl,
          github_url: profile.githubUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "Unable to save profile");
      }
      showToast("Profile updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (password.newPassword !== password.confirmPassword) {
      showToast("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("API_TOKEN");
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          current_password: password.currentPassword,
          new_password: password.newPassword,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "Unable to update password");
      }
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("Password updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  function handleUpgrade() {
    showToast("Coming soon");
  }

  function downloadData() {
    showToast("We'll email this to you shortly");
  }

  const upgrade = nextTier(plan);
  const currentPlanLabel = plan === "max" ? "Max Plan" : plan === "pro" ? "Pro Plan" : "Free Plan";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FFFDF0] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-gray-500">
            Loading settings...
          </div>
        </div>
      </main>
    );
  }

  if (loadingError) {
    return (
      <main className="min-h-screen bg-[#FFFDF0] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-lg font-bold text-gray-900">Unable to load settings</p>
            <p className="mt-2 text-sm text-gray-500">{loadingError}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFFDF0] px-4 py-6 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Settings</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">Your account</h1>
          </div>
          <Link href="/mock" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-black hover:text-black">
            Back to mock
          </Link>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="sticky top-6 rounded-3xl border border-gray-200 bg-white p-3 lg:w-72">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {SECTIONS.map((section) => {
                const active = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`whitespace-nowrap rounded-2xl px-4 py-3 text-left text-sm transition lg:border-l-4 lg:pl-4 ${
                      active
                        ? "border-black bg-gray-50 font-bold text-black lg:rounded-r-2xl lg:rounded-l-xl lg:border-l-black"
                        : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-black lg:rounded-r-2xl lg:rounded-l-xl"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="flex-1 rounded-3xl border border-gray-200 bg-white p-5 sm:p-8">
            {activeSection === "profile" && (
              <div>
                <h2 className="mb-6 text-lg font-bold text-gray-900">Profile</h2>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFD600] text-2xl font-black text-black">
                    {getInitials(profile.fullName, profile.email)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{profile.fullName || "Your profile"}</p>
                    <p className="text-sm text-gray-500">{profile.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Full name</label>
                    <input value={profile.fullName} onChange={(e) => updateProfileField("fullName", e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                    <input value={profile.email} readOnly className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500 outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">College</label>
                    <input value={profile.college} onChange={(e) => updateProfileField("college", e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Year of study</label>
                    <select value={profile.yearOfStudy} onChange={(e) => updateProfileField("yearOfStudy", e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0">
                      <option value="">Select year</option>
                      {YEAR_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Branch</label>
                    <select value={profile.branch} onChange={(e) => updateProfileField("branch", e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0">
                      <option value="">Select branch</option>
                      {BRANCH_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Target companies</label>
                    <div className="flex flex-wrap gap-2">
                      {COMPANY_OPTIONS.map((company) => {
                        const selected = profile.targetCompanies.includes(company);
                        return (
                          <button
                            key={company}
                            type="button"
                            onClick={() => toggleCompany(company)}
                            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-black bg-black text-white" : "border-gray-200 bg-white text-gray-700 hover:border-black"}`}
                          >
                            {company}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">LinkedIn URL</label>
                    <input value={profile.linkedinUrl} onChange={(e) => updateProfileField("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">GitHub URL</label>
                    <input value={profile.githubUrl} onChange={(e) => updateProfileField("githubUrl", e.target.value)} placeholder="https://github.com/..." className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                  </div>
                </div>

                <button onClick={saveProfile} disabled={savingProfile} className="mt-6 w-full rounded-xl bg-black px-6 py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-60">
                  {savingProfile ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}

            {activeSection === "account" && (
              <div className="space-y-8">
                <div>
                  <h2 className="mb-6 text-lg font-bold text-gray-900">Account</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Current password</label>
                      <input type="password" value={password.currentPassword} onChange={(e) => setPassword((prev) => ({ ...prev, currentPassword: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">New password</label>
                      <input type="password" value={password.newPassword} onChange={(e) => setPassword((prev) => ({ ...prev, newPassword: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Confirm new password</label>
                      <input type="password" value={password.confirmPassword} onChange={(e) => setPassword((prev) => ({ ...prev, confirmPassword: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" />
                    </div>
                  </div>
                  <button onClick={savePassword} disabled={!password.newPassword || password.newPassword !== password.confirmPassword || savingPassword} className="mt-4 rounded-xl bg-black px-6 py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-60">
                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>

                <div>
                  <h3 className="mb-4 text-base font-bold text-gray-900">Connected accounts</h3>
                  <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div>
                      <p className="font-semibold text-gray-900">Google</p>
                      <p className="text-sm text-gray-500">Connect your Google account later</p>
                    </div>
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">Coming soon</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="mb-2 text-base font-bold text-gray-900">Danger zone</h3>
                  <p className="mb-4 text-sm text-gray-600">Delete your account and all session data. This action cannot be undone.</p>
                  <button onClick={() => setDeleteModalOpen(true)} className="rounded-xl border border-red-300 px-4 py-2.5 font-bold text-red-600 hover:bg-red-100">
                    Delete account
                  </button>
                </div>
              </div>
            )}

            {activeSection === "plan" && (
              <div className="space-y-8">
                <div>
                  <h2 className="mb-6 text-lg font-bold text-gray-900">Plan & Usage</h2>
                  <div className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${planBadgeClass(plan)}`}>
                    {currentPlanLabel}
                  </div>
                </div>

                {plan === "free" && (
                  <div>
                    <p className="mb-2 text-sm text-gray-600">3 of 3 sessions used this month</p>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full w-full rounded-full bg-black" />
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-4 text-base font-bold text-gray-900">What's included</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {plan === "free" && (
                      <>
                        <li>• 3 sessions/month</li>
                        <li>• 5 questions</li>
                        <li>• Basic report</li>
                      </>
                    )}
                    {plan === "pro" && (
                      <>
                        <li>• Unlimited sessions</li>
                        <li>• Model answers</li>
                        <li>• Company prep</li>
                      </>
                    )}
                    {plan === "max" && (
                      <>
                        <li>• Everything in Pro</li>
                        <li>• Retry answers</li>
                        <li>• Multi-agent (coming soon)</li>
                      </>
                    )}
                  </ul>
                </div>

                {upgrade && (
                  <div className="rounded-2xl border border-gray-200 bg-[#FFFDF0] p-5">
                    <p className="text-sm font-semibold text-gray-600">Next tier</p>
                    <p className="mt-1 text-xl font-black text-gray-900">Upgrade to {upgrade.name} — {upgrade.price}</p>
                    <button onClick={handleUpgrade} className="mt-4 rounded-xl bg-black px-6 py-3 font-bold text-white hover:bg-gray-800">
                      Upgrade to {upgrade.name}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection === "privacy" && (
              <div className="space-y-8">
                <div>
                  <h2 className="mb-6 text-lg font-bold text-gray-900">Privacy & Notifications</h2>
                  <div className="space-y-3">
                    {NOTIFICATION_ITEMS.map((item) => {
                      const enabled = notifications[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleNotification(item.key)}
                          className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.hint}</p>
                          </div>
                          <span className={`h-7 w-12 rounded-full p-1 transition ${enabled ? "bg-black" : "bg-gray-200"}`}>
                            <span className={`block h-5 w-5 rounded-full bg-white transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-base font-bold text-gray-900">Data</h3>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={downloadData} className="rounded-xl bg-black px-6 py-3 font-bold text-white hover:bg-gray-800">
                      Download my data
                    </button>
                    <Link href="/privacy" className="rounded-xl border border-gray-200 px-6 py-3 font-bold text-gray-700 hover:border-black hover:text-black">
                      How Qued uses your data →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete account</h3>
            <p className="mt-2 text-sm text-gray-600">This will permanently delete your account and all session data. Type DELETE to confirm.</p>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-black focus:ring-0" placeholder="Type DELETE" />
            <div className="mt-5 flex gap-3">
              <button onClick={() => { setDeleteModalOpen(false); setDeleteConfirm(""); }} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-bold text-gray-700 hover:border-black hover:text-black">
                Cancel
              </button>
              <button onClick={() => { showToast("Coming soon"); setDeleteModalOpen(false); setDeleteConfirm(""); }} disabled={deleteConfirm !== "DELETE"} className="flex-1 rounded-xl border border-red-300 px-4 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
