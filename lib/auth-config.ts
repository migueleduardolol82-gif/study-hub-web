export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      && process.env.CLERK_SECRET_KEY,
  );
}

export function isCloudConfigured() {
  return isClerkConfigured() && Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
