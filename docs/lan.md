# Play on your LAN (dev only)

Host multiplayer on this machine for others on the same network. Uses the dev server and a
local room server with `DEV_AUTH=1` (any `dev:` token is trusted). Room server: [multiplayer.md](./multiplayer.md).

Two terminals:

```bash
pnpm lan:rooms
```

```bash
pnpm lan:web
```

Players open `http://<ip>:3100` (`lan:web` prints it). The web port is 3100 so it doesn't clash
with anything on 3000; `LAN_PORT=…` picks another — set it the same in **both** terminals, since
the room server only accepts that origin.

- `scripts/lan.mjs` finds the LAN address (the private IPv4 the default route uses; `LAN_IP=…` overrides) and the web port (3100; `LAN_PORT=…` overrides) and runs
  `rooms:dev` / `dev` on `0.0.0.0` with `ALLOWED_ORIGINS`, `PUBLIC_URL` and
  `NEXT_PUBLIC_ROOMS_URL` pointed at it. One child process each, no supervisor.
- `allowedDevOrigins` in `next.config.ts` lets private-range origins load the dev server.
- `NEXT_PUBLIC_ROOMS_DEV_AUTO=1` (`src/lib/multiplayer/client.ts`): each browser stores a
  `dev:<random>:member` token in `localStorage` (`pip.roomsDevToken`) on first load, so anyone
  can host. One browser = one player; use a private window for a second.
- Camera and mic need HTTPS or `localhost`, so they don't work over a LAN address.
