/**
 * Checks the Cloudflare Access sign-in on admin requests.
 *
 * rhymo-admin.vitalize.dev is behind Cloudflare Access. Every request that
 * passed Access carries a token signed by Cloudflare (header
 * Cf-Access-Jwt-Assertion, also the CF_Authorization cookie). The admin panel
 * sends its API calls through that hostname, so admin requests carry it.
 *
 * The header alone proves nothing: port 3500 is reachable from the internet
 * and anyone can send any header. So the token's signature is checked against
 * Cloudflare's published keys, and its team (issuer) and app (audience) must
 * be ours. A token from someone else's Cloudflare team fails here.
 *
 * Turned on by two settings in .env.local:
 *   CF_ACCESS_TEAM_DOMAIN=https://vitalize.cloudflareaccess.com
 *   CF_ACCESS_AUD=<the Access application's AUD tag>
 * Read when used, not at import: .env.local is loaded after imports run.
 */
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const KEYS_TTL_MS = 60 * 60 * 1000
let keyCache = { team: null, at: 0, keys: new Map() }

function settings() {
    const team = (process.env.CF_ACCESS_TEAM_DOMAIN || '').trim().replace(/\/+$/, '')
    const aud = (process.env.CF_ACCESS_AUD || '').trim()
    return team && aud ? { team, aud } : null
}

export function accessConfigured() {
    return settings() !== null
}

async function loadKeys(team) {
    const res = await fetch(`${team}/cdn-cgi/access/certs`)
    if (!res.ok) throw new Error(`Could not get Cloudflare Access keys: HTTP ${res.status}`)
    const body = await res.json()
    const keys = new Map()
    for (const k of body.keys || []) {
        keys.set(k.kid, crypto.createPublicKey({ key: k, format: 'jwk' }))
    }
    keyCache = { team, at: Date.now(), keys }
}

async function keyFor(team, kid) {
    const stale = keyCache.team !== team || Date.now() - keyCache.at > KEYS_TTL_MS
    if (stale || !keyCache.keys.has(kid)) await loadKeys(team) // keys rotate: fetch again once
    return keyCache.keys.get(kid)
}

function tokenFrom(req) {
    const header = req.headers['cf-access-jwt-assertion']
    if (header) return String(header)
    const cookie = req.headers.cookie || ''
    const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
}

/**
 * The signed-in person's claims (email, ...), or null when there is no valid
 * Access token. Throws only when Cloudflare's keys cannot be fetched.
 */
export async function verifyAccess(req) {
    const s = settings()
    if (!s) return null
    const token = tokenFrom(req)
    if (!token) return null

    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || !decoded.header || !decoded.header.kid) return null
    const key = await keyFor(s.team, decoded.header.kid)
    if (!key) return null

    try {
        return jwt.verify(token, key, { algorithms: ['RS256'], audience: s.aud, issuer: s.team })
    } catch {
        return null
    }
}
