import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { StudyHub } from "@/components/study-hub";
import { isClerkConfigured, isCloudConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authEnabled = isClerkConfigured();
  let accountId: string | undefined;
  if (authEnabled) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
    accountId = userId;
  }
  return <StudyHub accountId={accountId} authEnabled={authEnabled} cloudEnabled={isCloudConfigured()} />;
}
