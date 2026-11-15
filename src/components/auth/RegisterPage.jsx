import { useState } from "react";
import { Lock, Mail, UserPlus } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/localClient";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setBusy(true);
    try {
      await localClient.auth.register({ username, email, password });
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Gagal membuat akun.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={UserPlus} title="Buat akun owner" subtitle="Akun pertama menjadi owner panel ini">
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-username">Username</Label>
          <Input id="register-username" autoComplete="username" autoFocus placeholder="username" value={username} onChange={(event) => setUsername(event.target.value)} className="h-12" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Password (minimal 10 karakter)</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-password" type="password" autoComplete="new-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm">Konfirmasi password</Label>
          <Input id="register-confirm" type="password" autoComplete="new-password" placeholder="Ulangi password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-12" required />
        </div>
        <SubmitButton busy={busy} busyLabel="Membuat akun...">Buat akun</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <AuthLink to="/login">Login</AuthLink>
      </p>
    </AuthLayout>
  );
}
