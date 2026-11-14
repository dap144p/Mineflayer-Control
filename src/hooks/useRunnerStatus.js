import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function useRunnerStatus() {
  const { data: runner, isLoading } = useQuery({
    queryKey: ["runner-record"],
    queryFn: async () => {
      const page = await base44.entities.Runner.list({ sort: "-created_date", limit: 1 });
      const items = page.items ?? page;
      return items[0] ?? null;
    },
    refetchInterval: 8000,
  });

  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const lastSeen = runner?.last_seen ? new Date(runner.last_seen).getTime() : 0;
  const online = lastSeen > 0 && now > 0 && now - lastSeen < 30000;

  return { runner, isLoading, online };
}