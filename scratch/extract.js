const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('/Users/javierfernandez/.gemini/antigravity/brain/4c06f0e4-a61c-4239-bf6d-e8c229f460d8/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"step_index":353,')) {
      console.log(line);
      break;
    }
  }
}

main().catch(console.error);
