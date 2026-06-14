export function isPrismaForeignKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export function foreignKeyRepairMessage() {
  return "Could not prepare your account for this action. Please sign out and back in, then try again.";
}
