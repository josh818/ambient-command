import { readFileSync, writeFileSync } from 'node:fs';

// Expo single-page exports do not render app/+html.tsx.
const path = 'dist/index.html';
let html = readFileSync(path, 'utf8');
const fonts = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap">
<style id="brand-typography">
html, body { font-family: 'Space Grotesk', system-ui, sans-serif; }
[class*="css-text"]:not([style*="font-family"]), input:not([style*="font-family"]), textarea:not([style*="font-family"]) {
  font-family: 'Space Grotesk', system-ui, sans-serif;
}
</style>
`;
if (!html.includes('id="brand-typography"')) html = html.replace('</head>', fonts + '</head>');
writeFileSync(path, html);
