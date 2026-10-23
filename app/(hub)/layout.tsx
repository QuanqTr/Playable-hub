import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function HubLayout({ children }: { children: React.ReactNode }) { const { profile } = await requireUser(); return <AppShell profile={profile}>{children}</AppShell>; }
