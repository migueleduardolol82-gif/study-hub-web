import { AuthShell } from "@/components/auth-shell";
import { isClerkConfigured } from "@/lib/auth-config";

export default function SignUpPage() {
  return <AuthShell mode="sign-up" configured={isClerkConfigured()} />;
}
