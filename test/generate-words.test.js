/**
 * test/generate-words.test.js
 * Integration tests for stream decompression, line parsing, and atomic write.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import http from 'node:http';
import { processDump, fetchWithRetry } from '../scripts/generate-words.mjs';
import { StratifiedWeightedSampler, createPRNG } from '../scripts/wotd-utils.mjs';

describe('Streaming Pipeline & Generator Integration', () => {
  const testOutputDir = path.resolve(process.cwd(), 'test');
  const testOutputFile = path.join(testOutputDir, 'test-words.json');

  test('fetchWithRetry follows relative redirect correctly', async () => {
    let requestCount = 0;
    const server = http.createServer((req, res) => {
      requestCount++;
      if (req.url === '/initial') {
        res.writeHead(302, { Location: '/target.json' });
        res.end();
      } else if (req.url === '/target.json') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      }
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const initialUrl = `http://127.0.0.1:${port}/initial`;

    try {
      const res = await fetchWithRetry(initialUrl, 3, 0, 5000);
      assert.equal(res.statusCode, 200);
      assert.equal(requestCount, 2);
      res.resume();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('streams through gzipped synthetic data and writes atomic JSON output', async () => {
    const mockFixturePath = path.resolve(process.cwd(), 'test/fixtures/kaikki-mock.json');
    const entries = JSON.parse(fs.readFileSync(mockFixturePath, 'utf8'));

    // Create a newline-delimited JSON string
    const jsonlString = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

    // Compress to gzip buffer
    const gzippedBuffer = zlib.gzipSync(Buffer.from(jsonlString, 'utf8'));

    // Create readable stream from gzip buffer
    const stream = Readable.from([gzippedBuffer]);

    const sampler = new StratifiedWeightedSampler(
      { noun: 5, verb: 5, adj: 5, adv: 5 },
      createPRNG(42)
    );

    const samples = await processDump(stream, sampler, testOutputFile);

    assert.ok(Array.isArray(samples));
    assert.ok(samples.length >= 2);
    assert.equal(fs.existsSync(testOutputFile), true);

    const writtenData = JSON.parse(fs.readFileSync(testOutputFile, 'utf8'));
    assert.equal(writtenData.length, samples.length);
    assert.ok(writtenData.some(item => item.w === 'serendipity'));
    assert.ok(writtenData.some(item => item.w === 'resilient'));

    // Cleanup
    if (fs.existsSync(testOutputFile)) fs.unlinkSync(testOutputFile);
  });
});
