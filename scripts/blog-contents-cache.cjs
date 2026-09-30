const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@notionhq/client');
const cliProgress = require('cli-progress');
const { PromisePool } = require('@supercharge/promise-pool');
const { loadEnvLocal } = require('./load-env-local.cjs');

loadEnvLocal();

const { retrievePageBlocks } = require('./retrieve-block-children.cjs');

const cacheDir = path.resolve(__dirname, '..', 'tmp');
const manifestPath = path.join(cacheDir, 'cache-manifest.json');
const manifestVersion = 1;

const notion = new Client({ auth: process.env.NOTION_API_SECRET });

const getDatabaseIdHash = () =>
  crypto.createHash('sha256').update(process.env.DATABASE_ID).digest('hex');

const createManifest = () => ({
  version: manifestVersion,
  databaseIdHash: getDatabaseIdHash(),
  pages: {},
});

const readManifest = () => {
  if (!fs.existsSync(manifestPath)) {
    return createManifest();
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (
      manifest.version !== manifestVersion ||
      manifest.databaseIdHash !== getDatabaseIdHash() ||
      !manifest.pages ||
      typeof manifest.pages !== 'object'
    ) {
      return createManifest();
    }
    return manifest;
  } catch (error) {
    console.warn('Ignoring an invalid Notion cache manifest.');
    return createManifest();
  }
};

const writeManifest = (manifest) => {
  fs.mkdirSync(cacheDir, { recursive: true });
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(manifest, null, 2));
    fs.renameSync(temporaryPath, manifestPath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
};

const hasValidCache = (page, entry) => {
  if (!entry || entry.lastEditedTime !== page.last_edited_time) {
    return false;
  }

  const rootCachePath = path.join(cacheDir, `${page.id}.json`);
  if (!fs.existsSync(rootCachePath) || !Array.isArray(entry.files)) {
    return false;
  }

  return entry.files.every((filename) =>
    fs.existsSync(path.join(cacheDir, filename))
  );
};

const getAllPages = async () => {
  const params = {
    database_id: process.env.DATABASE_ID,
    filter: {
      and: [
        {
          property: 'Published',
          checkbox: {
            equals: true,
          },
        },
        {
          property: 'Date',
          date: {
            on_or_before: new Date().toISOString(),
          },
        },
      ],
    },
  };

  let results = [];
  while (true) {
    const res = await notion.databases.query(params);
    results = results.concat(res.results);

    if (!res.has_more) {
      break;
    }
    params.start_cursor = res.next_cursor;
  }

  return results.map((result) => ({
    id: result.id,
    last_edited_time: result.last_edited_time,
  }));
};

const main = async () => {
  for (const name of ['NOTION_API_SECRET', 'DATABASE_ID']) {
    if (!process.env[name]) {
      throw new Error(`${name} is required to update the Notion cache.`);
    }
  }

  const pages = await getAllPages();
  const manifest = readManifest();
  const configuredConcurrency = Number.parseInt(
    process.env.CACHE_CONCURRENCY || '1',
    10
  );
  const concurrency =
    Number.isInteger(configuredConcurrency) && configuredConcurrency > 0
      ? configuredConcurrency
      : 1;

  const progressBar = new cliProgress.SingleBar(
    { stopOnComplete: true },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(pages.length, 0);

  const { errors } = await PromisePool.withConcurrency(concurrency)
    .for(pages)
    .process(async (page) => {
      try {
        if (hasValidCache(page, manifest.pages[page.id])) {
          return;
        }

        const files = await retrievePageBlocks(page.id);
        manifest.pages[page.id] = {
          lastEditedTime: page.last_edited_time,
          files,
        };
      } finally {
        progressBar.increment();
      }
    });

  progressBar.stop();
  writeManifest(manifest);

  if (errors.length > 0) {
    throw new Error(`Failed to update ${errors.length} Notion cache item(s).`);
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createManifest,
  hasValidCache,
  readManifest,
  writeManifest,
};
