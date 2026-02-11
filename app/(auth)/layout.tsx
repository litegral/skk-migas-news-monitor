import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in - SKK Migas News Monitor",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
