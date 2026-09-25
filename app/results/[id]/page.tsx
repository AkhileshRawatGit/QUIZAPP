import { redirect } from "next/navigation";

/**
 * Result page is disabled for participants.
 * Admin can view results from /admin/leaderboard.
 */
export default async function ResultPage() {
    redirect("/dashboard");
}
