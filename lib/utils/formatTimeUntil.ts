/**
 * Human-readable remaining time until a future date (Indonesian).
 */
export function formatTimeUntil(date: Date): string {
  const now = Date.now();
  const target = date.getTime();
  const diff = target - now;

  if (diff <= 0) return "Sekarang";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours} jam ${remainingMinutes} menit`;
  }
  return `${minutes} menit`;
}
