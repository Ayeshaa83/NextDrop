const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// Header
code = code.replace(/<header className="flex justify-between items-center mb-10">/g, '<header className="flex justify-between items-center mb-10 animate-fade-in-up">');

// Grid main left - total streams
code = code.replace(/className="col-span-8 glass-card p-6 rounded-3xl relative overflow-hidden group"/g, 'className="col-span-8 glass-card p-6 rounded-3xl relative overflow-hidden group animate-fade-in-up animate-delay-100"');

// Grid main right - users
code = code.replace(/className="col-span-4 flex flex-col gap-6"/g, 'className="col-span-4 flex flex-col gap-6 animate-fade-in-up animate-delay-200"');

// Grid bottom left - performance
code = code.replace(/className="col-span-7 glass-card p-6 rounded-3xl"/g, 'className="col-span-7 glass-card p-6 rounded-3xl animate-fade-in-up animate-delay-300"');

// Grid bottom right - visual vibe
code = code.replace(/className="col-span-5 glass-card p-6 rounded-3xl flex flex-col"/g, 'className="col-span-5 glass-card p-6 rounded-3xl flex flex-col animate-fade-in-up animate-delay-400"');

// Background blobs
code = code.replace(/blur-\[120px\]/g, 'blur-[120px] animate-pulse-slow');

// Footer
code = code.replace(/<footer className="mt-10 mb-6 flex items-center/g, '<footer className="mt-10 mb-6 flex items-center animate-fade-in-up animate-delay-400 ');

// Floating effect for the avatar
code = code.replace(
    /alt="Taylor Swift Portrait" className="w-full h-full object-cover rounded-xl"/g,
    'alt="Taylor Swift Portrait" className="w-full h-full object-cover rounded-xl transition-transform duration-700 hover:scale-110 hover:-rotate-2"'
);

// Sidebar elements hover
code = code.replace(/hover:bg-white\/5 transition-all"/g, 'hover:bg-white/5 transition-all hover:translate-x-1"');

fs.writeFileSync('app/page.tsx', code);
console.log("Updated page.tsx animations");
