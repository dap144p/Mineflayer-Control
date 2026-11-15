import { redirect } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { authQuery } from "@/lib/AuthContext";

export async function requireSignedIn({ context, location }) {
  const { user } = await context.queryClient.ensureQueryData(authQuery);
  if (user) return { user };
  throw redirect({
    to: "/login",
    search: { returnTo: location.href },
    reloadDocument: true,
  });
}

export function AuthGateError({ error }) {
  return <DefaultCatchBoundary error={error} />;
}
