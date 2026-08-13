import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in - SKK Migas Kalsul News Monitor",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-[#080d17]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.09),transparent_32%)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
