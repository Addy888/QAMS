import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditionally join Tailwind classes and merge conflicting utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Shared date-time formatter used across audit list rows, audit detail
 * headers, and history views.
 *
 * Renders an enterprise-friendly clean format like "09 May 2026, 12:07 PM".
 * Always returns "—" for null/empty inputs so callers don't have to guard.
 */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return "—";
    const datePart = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return typeof iso === "string" ? iso : "—";
  }
}

/**
 * Date-only formatter — kept for cases where time isn't meaningful.
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return typeof iso === "string" ? iso : "—";
  }
}
