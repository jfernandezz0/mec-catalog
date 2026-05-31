const fs = require('fs');
const content = fs.readFileSync('scratch/replace_225_3.txt', 'utf8');
const lines = content.split('\n');
console.log(`Total lines in file: ${lines.length}`);
for (let i = 0; i < lines.length; i += 20) {
  console.log(`--- Lines ${i} to ${i + 20} ---`);
  console.log(lines.slice(i, i + 20).join('\n'));
}
