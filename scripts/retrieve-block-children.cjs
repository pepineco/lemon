const fs = require('node:fs');
const path = require('node:path');
const { setTimeout } = require('node:timers/promises');
const { Client } = require('@notionhq/client');
const { loadEnvLocal } = require('./load-env-local.cjs');

loadEnvLocal();

const notion = new Client({ auth: process.env.NOTION_API_SECRET });
const cacheDir = path.resolve(__dirname, '..', 'tmp');
const requestDuration = 300;

const retry = (maxRetries, fn) => {
  return fn().catch((error) => {
    if (maxRetries <= 0) {
      throw error;
    }
    return retry(maxRetries - 1, fn);
  });
};

const writeCacheFile = (blockId, value, files) => {
  fs.mkdirSync(cacheDir, { recursive: true });
  const filename = `${blockId}.json`;
  const targetPath = path.join(cacheDir, filename);
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value));
    fs.renameSync(temporaryPath, targetPath);
    files.add(filename);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
};

const retrievePageBlocks = async (pageId) => {
  if (!process.env.NOTION_API_SECRET) {
    throw new Error('NOTION_API_SECRET is required to retrieve Notion blocks.');
  }
  if (!pageId) {
    throw new Error('A Notion page ID is required.');
  }

  const files = new Set();
  const visitedChildren = new Set();
  const visitedBlocks = new Set();

  const retrieveAndWriteBlockChildren = async (blockId) => {
    if (visitedChildren.has(blockId)) {
      return;
    }
    visitedChildren.add(blockId);

    const params = { block_id: blockId };
    let results = [];

    while (true) {
      await setTimeout(requestDuration);
      const res = await retry(3, () => notion.blocks.children.list(params));
      results = results.concat(res.results);

      if (!res.has_more) {
        break;
      }
      params.start_cursor = res.next_cursor;
    }

    writeCacheFile(blockId, results, files);

    for (const block of results) {
      if (
        block.type === 'synced_block' &&
        block.synced_block.synced_from &&
        block.synced_block.synced_from.block_id
      ) {
        await retrieveAndWriteBlock(block.synced_block.synced_from.block_id);
      } else if (block.has_children) {
        await retrieveAndWriteBlockChildren(block.id);
      }
    }
  };

  const retrieveAndWriteBlock = async (blockId) => {
    if (visitedBlocks.has(blockId)) {
      return;
    }
    visitedBlocks.add(blockId);

    const params = { block_id: blockId };
    await setTimeout(requestDuration);
    const block = await retry(3, () => notion.blocks.retrieve(params));

    writeCacheFile(blockId, block, files);

    if (block.has_children) {
      await retrieveAndWriteBlockChildren(block.id);
    }
  };

  await retrieveAndWriteBlockChildren(pageId);
  return [...files].sort();
};

if (require.main === module) {
  retrievePageBlocks(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { retrievePageBlocks };
