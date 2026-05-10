// Reset the owner password gate.
//
// What this does:
//   - Clears auth_settings.password_hash (the next /admin visit goes
//     to /admin/setup again).
//   - Rotates auth_settings.session_secret (every signed cookie in the
//     wild becomes invalid → all open admin tabs are logged out).
//
// Use cases:
//   - You forgot the password.
//   - You suspect a session token leaked (panic button).
//   - You're handing the deploy off to a new operator.
//
// Out-of-band only — there's no /admin endpoint that can do this,
// because if you could call it via the cockpit you'd already be
// authenticated. Run from the server shell:
//
//   bun run auth:reset
//
// Idempotent. Running it twice just re-rotates the secret; the password
// stays cleared.

import { resetAuthSettings, isOwnerPasswordSet } from '../domain/auth.ts'

const before = isOwnerPasswordSet()
resetAuthSettings()
const after = isOwnerPasswordSet()

console.log()
console.log('  password before:', before ? 'set' : 'not set')
console.log('  password after :', after ? 'set' : 'cleared')
console.log('  session secret : rotated (all open sessions invalidated)')
console.log()
console.log('Next visit to /admin/* will redirect to /admin/setup.')
console.log('The Telegram Mini App path is unaffected.')
