// DiceBear avatar styles — free = adventurer, premium = locked behind purchase
export type AvatarStyle = 'adventurer' | 'avataaars' | 'bottts' | 'lorelei' | 'fun-emoji' | 'micah'

export const AVATAR_STYLES: { id: AvatarStyle; name: string; price: number; preview: string }[] = [
  { id: 'adventurer', name: 'Adventurer',  price: 0,    preview: '🆓' },
  { id: 'avataaars',  name: 'Cartoonish',  price: 2,    preview: '💎' },
  { id: 'bottts',     name: 'Robot',       price: 3,    preview: '🤖' },
  { id: 'lorelei',    name: 'Lorelei',     price: 2,    preview: '✨' },
  { id: 'fun-emoji',  name: 'Fun Emoji',   price: 1,    preview: '🎉' },
  { id: 'micah',      name: 'Micah',       price: 3,    preview: '🎨' },
]

/** Return a DiceBear SVG URL for a given address + style */
export function getAvatarUrl(address: string, style: AvatarStyle = 'adventurer'): string {
  const seed = address.toLowerCase().replace('0x', '').slice(0, 16)
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${seed}&size=80`
}

/** Get avatar URL using the user's saved style preference */
export function getAvatarUrlForUser(address: string): string {
  const saved = localStorage.getItem(`ag_style_${address.toLowerCase()}`) as AvatarStyle | null
  return getAvatarUrl(address, saved ?? 'adventurer')
}

/** Accent color derived from address (for border/glow) */
const COLORS = ['#7c3aed','#06b6d4','#22c55e','#f59e0b','#ec4899','#ef4444','#a78bfa','#34d399']
export function getAvatarColor(address: string): string {
  const h = address.toLowerCase().split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7)
  return COLORS[h % COLORS.length]
}
