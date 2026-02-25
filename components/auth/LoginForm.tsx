"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RiMailLine, RiLockLine } from "@remixicon/react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Terjadi kesalahan yang tidak terduga. Silakan coba lagi.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            inputClassName="pl-9"
            hasError={!!error}
          />
          <div className="pointer-events-none absolute bottom-0 left-2.5 flex h-full items-center">
            <RiMailLine
              className="size-4 text-gray-400 dark:text-gray-600"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Masukkan kata sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            inputClassName="pl-9"
            hasError={!!error}
          />
          <div className="pointer-events-none absolute bottom-0 left-2.5 flex h-full items-center">
            <RiLockLine
              className="size-4 text-gray-400 dark:text-gray-600"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        loadingText="Masuk..."
      >
        Sign in
      </Button>
    </form>
  );
}
