const fs = require('fs');

const files = [
    { path: 'app/page.tsx', route: '/' },
    { path: 'app/music/page.tsx', route: '/music' },
    { path: 'app/jamjar/page.tsx', route: '/jamjar' },
    { path: 'app/analytics/page.tsx', route: '/analytics' },
    { path: 'app/openverse/page.tsx', route: '/openverse' },
    { path: 'app/leaderboard/page.tsx', route: '/leaderboard' }
];

const getNavStructure = (activeRoute) => `<nav className="flex flex-col gap-8 mt-4">
          <Link className="${activeRoute === '/' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">home</span>
            ${activeRoute === '/' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <Link className="${activeRoute === '/jamjar' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/jamjar">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/jamjar' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">group</span>
            ${activeRoute === '/jamjar' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <Link className="${activeRoute === '/music' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/music">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/music' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">library_music</span>
            ${activeRoute === '/music' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <Link className="${activeRoute === '/openverse' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/openverse">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/openverse' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">mic</span>
            ${activeRoute === '/openverse' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <Link className="${activeRoute === '/analytics' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/analytics">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/analytics' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">analytics</span>
            ${activeRoute === '/analytics' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <Link className="${activeRoute === '/leaderboard' ? 'text-primary group relative transition-all hover:-translate-y-1' : 'text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group'}" href="/leaderboard">
            <span className="material-symbols-outlined text-[28px] ${activeRoute === '/leaderboard' ? 'nav-indicator-glow text-secondary drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]' : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}">emoji_events</span>
            ${activeRoute === '/leaderboard' ? '<div className="absolute -left-7 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-secondary rounded-r-full shadow-[0_0_10px_#00f2fe]"></div>' : ''}
          </Link>
          <a className="text-slate-500 hover:text-white transition-all hover:-translate-y-1 relative group" href="#">
            <span className="material-symbols-outlined text-[28px] group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">settings</span>
          </a>
        </nav>`;

files.forEach(fileObj => {
    try {
        let code = fs.readFileSync(fileObj.path, 'utf8');
        const newNav = getNavStructure(fileObj.route);

        let startIdx = code.indexOf('<nav');
        let endIdx = code.indexOf('</nav>') + 6;

        if (startIdx !== -1 && endIdx !== -1) {
            code = code.substring(0, startIdx) + newNav + code.substring(endIdx);
        }

        if (fileObj.path === 'app/page.tsx' && !code.includes("import Link from 'next/link'")) {
            code = "import Link from 'next/link';\n" + code;
        }

        fs.writeFileSync(fileObj.path, code);
        console.log("Updated nav in", fileObj.path);
    } catch (e) {
        console.log("Failed to update", fileObj.path, e);
    }
});
