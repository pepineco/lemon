const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const loadEnvLocal = () => {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const fileEnv = parseEnv(fs.readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

module.exports = { loadEnvLocal };
