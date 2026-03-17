const fs = require("fs");

let data = JSON.parse(fs.readFileSync("temp.json", "utf8"));

let jsx = data.body
    .replace(/class=/g, "className=")
    .replace(/for=/g, "htmlFor=")
    .replace(/<(img|input|br|hr|meta|link)\b([^>]*?[^\/])>/g, '<$1$2/>');

const pageCode = `export default function Dashboard() {
  return (
    ${jsx}
  );
}`;

fs.writeFileSync("app/page.tsx", pageCode);

let css = `
@import "tailwindcss";

@theme {
  --color-primary: #8b5cf6;
  --color-secondary: #06b6d4;
  --color-accent-pink: #ec4899;
  --color-background-dark: #0a0a12;
  --font-sans: "Inter", sans-serif;
}

${data.style || ""}
`;

fs.writeFileSync("app/globals.css", css);

try {
    let layout = fs.readFileSync("app/layout.tsx", "utf8");
    layout = layout.replace("</head>", `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" /></head>`);
    layout = layout.replace('<html lang="en">', '<html lang="en" className="dark">');
    fs.writeFileSync("app/layout.tsx", layout);
} catch (e) {
    console.log("No layout.tsx found or it failed.");
}
