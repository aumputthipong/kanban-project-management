import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { forwardedHeaders } from "@/lib/forwardedHeaders";
import { ApiWarmup } from "@/components/demo/ApiWarmup";
import { TryDemoButton } from "@/components/demo/TryDemoButton";
import { BoardPreview } from "@/components/landing/BoardPreview";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { WorkflowSteps } from "@/components/landing/WorkflowSteps";
import { LANDING_PATH, type UserSettings } from "@/types/userSettings";

export const metadata: Metadata = {
  title: "Turtask — Realtime task board for team projects",
  description:
    "Kanban แบบ realtime สำหรับทีมเล็ก ลองบอร์ดตัวอย่างได้ทันทีโดยไม่ต้องสมัคร",
};

async function resolveAuthedRedirect(): Promise<string | null> {
  const store = await cookies();
  if (!store.get("auth_token")) return null;
  try {
    const settings = await apiClient<UserSettings>("/me/settings", {
      cache: "no-store",
      headers: await forwardedHeaders(),
    });
    return LANDING_PATH[settings.default_landing] ?? "/my-work";
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const dest = await resolveAuthedRedirect();
  if (dest) redirect(dest);

  return (
    <div className="bg-white text-slate-900 font-sans">
      <section lang="th" className="px-6 md:px-12 pt-6 pb-8 md:pb-12">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-full">
            <BoardPreview />
          </div>

          <h1 lang="en" className="mt-8 text-center text-2xl font-semibold text-balance md:text-display">
            Realtime task board for team projects
          </h1>
          <ApiWarmup />
          <div className="mt-5 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <TryDemoButton />
            <Link
              href="/dashboard"
              className="flex w-full sm:w-auto items-center justify-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-6 py-3 rounded-md font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Open Workspace
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <WorkflowSteps />
      <LandingFooter />
    </div>
  );
}
