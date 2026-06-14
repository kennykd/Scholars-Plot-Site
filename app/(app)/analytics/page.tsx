import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getAnalyticsByUserId } from "@/lib/services/analyticService";
import { AnalyticsDashboardView } from "@/app/components/analytics/analytics-client";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const analyticsData = await getAnalyticsByUserId(session.id);

  return <AnalyticsDashboardView data={analyticsData} />;
}