const { createRequire } = require('module');
const path = require('path');

function getBinaryName() {
  const { platform, arch } = process;
  const platformMap = { linux: 'linux', darwin: 'darwin', win32: 'win32' };
  const archMap = { x64: 'x64', arm64: 'arm64' };
  const suffix = platform === 'win32' ? '.dll' : '.node';
  return `${platformMap[platform]}-${archMap[arch]}${suffix}`;
}

try {
  const binaryPath = path.join(__dirname, getBinaryName());
  const req = createRequire(__filename);
  module.exports = req(binaryPath);
} catch (e) {
  throw new Error(`Failed to load native binary: ${e.message}. Platform: ${process.platform}-${process.arch}`);
}
