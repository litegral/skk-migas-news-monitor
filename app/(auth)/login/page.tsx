import { RiOilLine } from "@remixicon/react";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      {/* Logo / branding */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-11 items-center justify-center rounded-lg bg-blue-500 text-white shadow-md">
          <RiOilLine className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          SKK Migas News Monitor
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kalimantan &amp; Sulawesi monitoring dashboard
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
