import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Forces a real download instead of the browser navigating to/streaming the
 * file. Needed because the HTML `download` attribute is silently ignored by
 * browsers for cross-origin URLs (e.g. our Supabase-hosted files) — it only
 * works same-origin. Fetching the bytes ourselves and downloading via a
 * blob: URL (always same-origin) works regardless of where the file lives.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
}
