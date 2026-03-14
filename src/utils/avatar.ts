// DiceBear avatar styles – free robot default + 100+ premium styles
// Style IDs: 'bottts' or 'bottts~b6e3f4' (base~bgcolor)

export type AvatarStyle = string

export const BG_OPTIONS = [
  { code: '',       label: 'Classic'   },
  { code: 'b6e3f4', label: 'Sky'       },
  { code: 'c0aede', label: 'Lavender'  },
  { code: 'ffd5dc', label: 'Blush'     },
  { code: 'c1f4c5', label: 'Mint'      },
  { code: 'ffdfbf', label: 'Peach'     },
]

export interface StyleBase {
  key: string   // DiceBear style name
  name: string  // Display name
  price: number // 0 = free
}

export const STYLE_CATALOG: StyleBase[] = [
  // ── FREE ──────────────────────────────────────────────────────────────────
  { key: 'bottts',             name: 'Robot',     price: 0 },
  // ── $1 TIER ───────────────────────────────────────────────────────────────
  { key: 'bottts-neutral',     name: 'Bionic',    price: 1 },
  { key: 'pixel-art',          name: 'Pixel',     price: 1 },
  { key: 'pixel-art-neutral',  name: 'Retro',     price: 1 },
  { key: 'shapes',             name: 'Shapes',    price: 1 },
  { key: 'rings',              name: 'Rings',     price: 1 },
  { key: 'thumbs',             name: 'Thumbs',    price: 1 },
  { key: 'fun-emoji',          name: 'Emoji',     price: 1 },
  { key: 'icons',              name: 'Icons',     price: 1 },
  { key: 'miniavs',            name: 'Mini',      price: 1 },
  { key: 'identicon',          name: 'Identicon', price: 1 },
  // ── $2 TIER ───────────────────────────────────────────────────────────────
  { key: 'adventurer',         name: 'Explorer',  price: 2 },
  { key: 'adventurer-neutral', name: 'Wanderer',  price: 2 },
  { key: 'lorelei',            name: 'Lorelei',   price: 2 },
  { key: 'lorelei-neutral',    name: 'Echo',      price: 2 },
  { key: 'micah',              name: 'Micah',     price: 2 },
  { key: 'croodles',           name: 'Doodle',    price: 2 },
  { key: 'croodles-neutral',   name: 'Sketch',    price: 2 },
  { key: 'big-ears',           name: 'Big Ears',  price: 2 },
  { key: 'big-ears-neutral',   name: 'Ears',      price: 2 },
  { key: 'big-smile',          name: 'Smile',     price: 2 },
  // ── $3 TIER ───────────────────────────────────────────────────────────────
  { key: 'avataaars',          name: 'Cartoon',   price: 3 },
  { key: 'avataaars-neutral',  name: 'Toon',      price: 3 },
  { key: 'open-peeps',         name: 'Peeps',     price: 3 },
  { key: 'personas',           name: 'Persona',   price: 3 },
  { key: 'notionists',         name: 'Notion',    price: 3 },
  { key: 'notionists-neutral', name: 'Clean',     price: 3 },
]
// 28 bases × 6 color options = 168 total combinations

export interface AvatarEntry {
  id: AvatarStyle  // e.g. 'bottts' or 'bottts~c0aede'
  name: string     // e.g. 'Robot' or 'Robot · Lavender'
  baseKey: string  // e.g. 'bottts'
  baseName: string // e.g. 'Robot'
  price: number
  bgCode: string   // '' or 'c0aede'
  bgLabel: string  // 'Classic' or 'Lavender'
}

export const AVATAR_STYLES: AvatarEntry[] = STYLE_CATALOG.flatMap(s =>
  BG_OPTIONS.map(c => ({
    id: c.code ? `${s.key}~${c.code}` : s.key,
    name: c.code ? `${s.name} · ${c.label}` : s.name,
    baseKey: s.key,
    baseName: s.name,
    price: s.price,
    bgCode: c.code,
    bgLabel: c.label,
  }))
)

/** Parse 'bottts~c0aede' → { dicebearStyle: 'bottts', bgColor: 'c0aede' } */
export function parseStyleId(id: AvatarStyle): { dicebearStyle: string; bgColor: string } {
  const idx = id.indexOf('~')
  if (idx === -1) return { dicebearStyle: id, bgColor: '' }
  return { dicebearStyle: id.slice(0, idx), bgColor: id.slice(idx + 1) }
}

/** Build a DiceBear SVG URL */
export function getAvatarUrl(address: string, style: AvatarStyle = 'bottts'): string {
  const seed = address.toLowerCase().replace('0x', '').slice(0, 16)
  const { dicebearStyle, bgColor } = parseStyleId(style)
  let url = `https://api.dicebear.com/8.x/${dicebearStyle}/svg?seed=${seed}`
  if (bgColor) url += `&backgroundColor=${bgColor}`
  return url
}

/** Check if a style (any color variant) is owned — Robot is always free */
export function isStyleOwned(styleId: AvatarStyle, ownedBases: string[]): boolean {
  const { dicebearStyle } = parseStyleId(styleId)
  if (dicebearStyle === 'bottts') return true  // Robot always free
  return ownedBases.includes(dicebearStyle)
}

/** Derive a unique robot background color from wallet address for new users */
export function getDefaultStyle(address: string): AvatarStyle {
  const ROBOT_BG = ['b6e3f4', 'c0aede', 'ffd5dc', 'c1f4c5', 'ffdfbf', 'd1d4f9']
  const idx = parseInt(address.toLowerCase().slice(2, 4), 16) % ROBOT_BG.length
  return `bottts~${ROBOT_BG[idx]}`
}

/** Get avatar URL using saved style or address-derived robot default */
export function getAvatarUrlForUser(address: string): string {
  const saved = localStorage.getItem(`ag_style_${address.toLowerCase()}`)
  return getAvatarUrl(address, saved ?? getDefaultStyle(address))
}

/** Accent border color derived from address */
const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#a78bfa', '#34d399']
export function getAvatarColor(address: string): string {
  const h = address.toLowerCase().split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7)
  return ACCENT_COLORS[h % ACCENT_COLORS.length]
}
