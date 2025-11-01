#!/usr/bin/env node
/**
 * Kill processes on dev ports (3001, 8080) to prevent conflicts
 * Usage: node scripts/kill-ports.mjs
 */
import { execSync } from 'child_process';
import os from 'os';

const ports = [3001, 8080];
const platform = os.platform();

function killPort(port) {
  try {
    if (platform === 'win32') {
      // Windows: find PID using netstat, then kill
      const netstat = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = netstat.split('\n').filter(l => l.trim());
      const pids = new Set();
      for (const line of lines) {
        const match = line.match(/\s+(\d+)\s*$/);
        if (match) {
          pids.add(match[1]);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`✓ Killed PID ${pid} on port ${port}`);
        } catch (e) {
          // Ignore if already dead
        }
      }
      if (pids.size === 0) {
        console.log(`✓ Port ${port} is free`);
      }
    } else {
      // Unix-like: use lsof
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`✓ Killed PID ${pid} on port ${port}`);
      } else {
        console.log(`✓ Port ${port} is free`);
      }
    }
  } catch (e) {
    // Port not in use or command failed
    console.log(`✓ Port ${port} is free`);
  }
}

console.log('Clearing dev ports...\n');
for (const port of ports) {
  killPort(port);
}
console.log('\n✓ Done. Ports cleared. You can now run `npm run dev:both`\n');

