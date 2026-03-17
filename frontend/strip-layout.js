const fs = require('fs');

const files = [
    'app/page.tsx',
    'app/music/page.tsx',
    'app/jamjar/page.tsx',
    'app/analytics/page.tsx',
    'app/openverse/page.tsx',
    'app/leaderboard/page.tsx'
];

files.forEach(file => {
    try {
        let code = fs.readFileSync(file, 'utf8');

        // Find the start of `<aside...` and end of `</aside>`
        const asideStart = code.indexOf('<aside');
        const asideEnd = code.indexOf('</aside>') + 8;

        if (asideStart !== -1 && asideEnd !== -1) {
            code = code.slice(0, asideStart) + code.slice(asideEnd);
        }

        // Now remove the wrappers
        // Find `<div className="flex h-screen overflow-hidden bg-[#07070b]">` and remove it
        // Depending on exact spacing, I'll use regex
        code = code.replace(/<div className="flex h-screen overflow-hidden bg\[#07070b\]">\s*<main className="flex-1 overflow-y-auto relative flex flex-col scroll-smooth">/g, '<>');

        // Sometimes it has different spacing or no aside if previous script failed. 
        // More robust:
        code = code.replace(/<div className=\"flex h-screen[^\>]+>/g, '<>');
        code = code.replace(/<main className=\"flex-1[^\>]+>/g, '');

        // Finally, replace `</main> \n </div>` with `</>` at the end.
        code = code.replace(/<\/main>\s*<\/div>/g, '</>');

        // Remove unused Link import if exists in page and not used anymore (optional)

        fs.writeFileSync(file, code);
        console.log("Stripped sidebar wrapper from", file);

    } catch (e) {
        console.log("Failed to process", file, e);
    }
});
