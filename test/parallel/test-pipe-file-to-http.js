'use strict';
const common = require('../common');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cp = require('child_process');

common.refreshTmpDir();

const filename = path.join(common.tmpDir || '/tmp', 'big');
let clientReqComplete = false;
let count = 0;

const server = http.createServer((req, res) => {
  let timeoutId;
  assert.equal('POST', req.method);
  req.pause();

  setTimeout(() => {
    req.resume();
  }, 1000);

  req.on('data', (chunk) => {
    count += chunk.length;
  });

  req.on('end', () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end();
  });
});
server.listen(0);

server.on('listening', () => {
  const cmd = common.ddCommand(filename, 10240);

  cp.exec(cmd, (err, stdout, stderr) => {
    if (err) throw err;
    makeRequest();
  });
});

function makeRequest() {
  const req = http.request({
    port: server.address().port,
    path: '/',
    method: 'POST'
  });

  const s = fs.ReadStream(filename);
  s.pipe(req);
  s.on('close', (err) => {
    if (err) throw err;
    clientReqComplete = true;
  });

  req.on('response', (res) => {
    res.resume();
    res.on('end', () => {
      server.close();
    });
  });
}

process.on('exit', () => {
  assert.strictEqual(1024 * 10240, count);
  assert.ok(clientReqComplete);
});
