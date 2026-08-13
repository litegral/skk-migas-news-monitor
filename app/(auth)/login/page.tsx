import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/Divider";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      {/* Logo / branding */}
      <div className="mb-7 flex flex-col items-center gap-2">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
          <Image src="/kalsul_logo.jpeg" alt="Logo SKK Migas Kalsul" width={80} height={80} className="object-contain" />
        </div>
        <h1 className="mt-2 text-center text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          SKK Migas Kalsul
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          News Intelligence Workspace
        </p>
      </div>

      <Card className="p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-7 dark:shadow-black/20">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Masuk ke workspace
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Gunakan kredensial Anda untuk mengakses dashboard pemantauan.
        </p>

        <Divider />

        <LoginForm />
      </Card>
    </>
  );
}
