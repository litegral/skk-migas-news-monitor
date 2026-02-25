import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      {/* Logo / branding */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center bg-transparent">
          <Image src="/kalsul_logo.jpeg" alt="SKK Migas Kalsul Logo" width={140} height={140} className="object-contain" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 text-center">
          SKK Migas Kalsul
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Monitoring Dashboard
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Sign in to your account
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter your credentials to access the dashboard.
        </p>

        <Divider />

        <LoginForm />
      </Card>
    </>
  );
}
