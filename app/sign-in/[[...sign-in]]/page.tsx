import { AuthShell } from "@/components/auth-shell";
import { isClerkConfigured } from "@/lib/auth-config";

export default function SignInPage() {
  return <AuthShell mode="sign-in" configured={isClerkConfigured()} />;
}
