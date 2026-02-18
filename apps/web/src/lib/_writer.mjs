import { writeFileSync, readFileSync, unlinkSync } from 'fs';
const content = readFileSync(new URL('./_content.txt', import.meta.url), 'utf8');
const [,, outFile] = process.argv;
writeFileSync(outFile, content, 'utf8');
console.log('Written', content.length, 'chars to', outFile);
// Clean up
unlinkSync(new URL('./_writer.mjs', import.meta.url));
unlinkSync(new URL('./_content.txt', import.meta.url));
