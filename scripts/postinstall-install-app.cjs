/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'bazar-app');
const pkg = path.join(appDir, 'package.json');

if (!fs.existsSync(pkg)) {
  console.warn('[postinstall] No existe bazar-app/package.json; se omite.');
  process.exit(0);
}

execSync('npm install', {
  stdio: 'inherit',
  cwd: appDir,
  env: process.env,
  shell: process.platform === 'win32',
});
