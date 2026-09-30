const fs = require('node:fs');
const path = require('node:path');

const cacheDir = path.resolve(__dirname, '..', 'tmp');

if (fs.existsSync(cacheDir)) {
  for (const entry of fs.readdirSync(cacheDir)) {
    if (entry !== '.gitkeep') {
      fs.rmSync(path.join(cacheDir, entry), { recursive: true, force: true });
    }
  }
}
