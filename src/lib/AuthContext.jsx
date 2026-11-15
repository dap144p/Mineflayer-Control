import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { base44 } from "@/api/base44Client";

export const authQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async () => {
    try {
      return { user: await base44.auth.me(), error: null };
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) return { user: null, error: null };
      throw error;
    }
  },
  staleTime: Infinity,
  retry: false,
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(authQuery);

  const value = useMemo(() => ({
    user: data?.user ?? null,
    isAuthenticated: Boolean(data?.user),
    isLoadingAuth: isPending,
    authError: error ? { type: "unknown", message: error.message || "Gagal memuat sesi." } : null,
    refresh: () => queryClient.fetchQuery({ ...authQuery, staleTime: 0 }),
    logout: async () => {
      await base44.auth.logout();
      queryClient.setQueryData(authQuery.queryKey, { user: null, error: null });
      window.location.href = "/login";
    },
    navigateToLogin: () => {
      window.location.href = "/login?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search);
    },
  }), [data, error, isPending, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
