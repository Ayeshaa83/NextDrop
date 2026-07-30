'use client';

import { usePathname } from 'next/navigation';
import { useRequireAdmin } from '@/lib/auth';

const SECTION_TITLES: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/approvals': 'Pending Approvals',
    '/admin/verification': 'Artist Verification',
    '/admin/platforms': 'Platform Management',
    '/admin/payouts': 'Payout Requests',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isLoading, isAdmin } = useRequireAdmin();
    const pathname = usePathname();
    const title = SECTION_TITLES[pathname] || 'Admin Panel';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400">You don&apos;t have permission to access this page.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Background */}
            <div className="absolute top-0 right-0 w-200 h-150 bg-primary/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-[-10%] w-150 h-125 bg-secondary/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>

            <div className="p-10 xl:p-14 max-w-7xl w-full mx-auto">
                <header className="mb-12 animate-fade-in-up">
                    <p className="text-primary font-black tracking-[0.2em] text-[10px] uppercase mb-2">System Administration</p>
                    <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-md">{title}</h1>
                </header>

                {children}
            </div>
        </>
    );
}
