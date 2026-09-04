"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Cloud, HardDrive } from "lucide-react";

function SignedInAccount({ compact = false }: { compact?: boolean }) {
  const { user } = useUser();
  const name = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || "Minha conta";
  return (
    <div className={compact ? "account-control compact" : "account-control"}>
      <UserButton showName={!compact} />
      {compact ? <span>{name}</span> : <small><Cloud size={12} /> conta individual</small>}
    </div>
  );
}

export function AccountControl({ enabled, compact = false }: { enabled: boolean; compact?: boolean }) {
  if (enabled) return <SignedInAccount compact={compact} />;
  return (
    <div className={compact ? "account-control local compact" : "account-control local"}>
      <span className="local-avatar">ME</span>
      <div><strong>Modo local</strong><small><HardDrive size={12} /> neste navegador</small></div>
    </div>
  );
}
