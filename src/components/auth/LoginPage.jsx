import { useEffect, useState } from "react";
import { Lock, LogIn, User } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/localClient";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localClient.auth.setup().then((result) => setSetupRequired(Boolean(result.setupRequired))).catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await localClient.auth.login({ username, password });
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Gagal login.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={LogIn} title="Mineflayer Control" subtitle={setupRequired ? "Buat akun owner untuk memulai panel" : "Login ke panel lokal kamu"}>
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-username">Username atau email</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="login-username" autoComplete="username" autoFocus placeholder="username" value={username} onChange={(event) => setUsername(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="login-password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Memeriksa...">Login</SubmitButton>
      </form>
      {setupRequired && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <AuthLink to="/register">Buat akun owner pertama</AuthLink>
        </p>
      )}
    </AuthLayout>
  );
}
