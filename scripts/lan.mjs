// `pnpm lan:rooms` / `pnpm lan:web`: the room server or the web app, reachable from the LAN
// (docs/lan.md). Finds this machine's LAN address so nobody types it. Run each in its own
// terminal. LAN_IP=… picks the address when the machine has several.

import { spawn } from 'node:child_process'
import dgram from 'node:dgram'
import os from 'node:os'

const WEB = 3000
const ROOMS = 8787
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

const found = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal && PRIVATE.test(i.address))
  .map((i) => i.address)

/** The address the default route sends from. Connecting a UDP socket sends nothing. */
const routed = await new Promise((resolve) => {
  const socket = dgram.createSocket('udp4')
  socket.once('error', () => resolve(null))
  socket.connect(53, '8.8.8.8', () => {
    resolve(socket.address().address)
    socket.close()
  })
})
const ip = process.env.LAN_IP ?? (found.includes(routed) ? routed : found[0])
if (!ip) {
  console.error('No LAN address found. Are you on a network? (or set LAN_IP=…)')
  process.exit(1)
}

const commands = {
  rooms: [
    ['rooms:dev', '--ip', '0.0.0.0', '--port', `${ROOMS}`, '--var', 'DEV_AUTH:1'],
    ['--var', `ALLOWED_ORIGINS:http://${ip}:${WEB},http://localhost:${WEB}`],
    ['--var', `PUBLIC_URL:http://${ip}:${ROOMS}`],
  ].flat(),
  web: ['dev', '-H', '0.0.0.0', '-p', `${WEB}`],
}
const which = process.argv[2]
if (!(which in commands)) {
  console.error('Usage: node scripts/lan.mjs <rooms|web>')
  process.exit(1)
}

const others = found.filter((a) => a !== ip)
console.log(`\n  LAN address ${ip}${others.length ? ` (others: ${others.join(', ')}; LAN_IP=… to pick)` : ''}`)
if (which === 'web') console.log(`  Players open http://${ip}:${WEB}\n`)

const child = spawn('pnpm', commands[which], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NEXT_PUBLIC_ROOMS_URL: `http://${ip}:${ROOMS}`,
    NEXT_PUBLIC_ROOMS_DEV_AUTO: '1',
  },
})
// Ctrl+C reaches the child directly (same terminal); just wait for it.
process.on('SIGINT', () => {})
child.on('exit', (code) => process.exit(code ?? 0))
