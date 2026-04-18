const fs= require('fs');
let html = fs.readFileSync('Input Data.html','utf8');
let matches = html.match(/<script[^>]*>([\s\S]*)<\/script>/);
if(!matches){ console.log('no script'); process.exit(1); }
let js = matches[1];
fs.writeFileSync('temp.js', js);
try { new Function(js); console.log('syntax ok'); } catch(e) { console.error('syntax error', e.message); process.exit(1);}