import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Admin Logs - SKK Migas Kalsul News Monitor",
};

export default async function AdminLogsPage() {
  const supabase = await createClient();

  // Fetch admin logs
  const { data: logs, error } = await supabase
    .from("admin_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Admin Logs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Riwayat interaksi dan perubahan yang dilakukan oleh admin.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-100">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
                <th className="px-4 py-3 font-medium">Tipe Entitas</th>
                <th className="px-4 py-3 font-medium">Nama Entitas</th>
                <th className="px-4 py-3 font-medium">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                    Gagal memuat log: {error.message}
                  </td>
                </tr>
              ) : !logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center">
                    Belum ada log interaksi.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {log.action_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">{log.entity_type}</td>
                    <td className="px-4 py-3">{log.entity_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.user_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
