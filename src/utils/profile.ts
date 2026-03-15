const P = 'ag_'

const ADJS  = ['Brave','Swift','Dark','Iron','Bold','Sly','Wild','Frost','Storm','Blaze','Cyber','Neon','Pixel','Steel','Ghost','Nova','Lunar','Solar','Turbo','Hyper','Shadow','Crimson','Savage','Rogue','Sigma']
const NOUNS = ['Fox','Wolf','Bear','Hawk','Lion','Tiger','Shark','Eagle','Viper','Dragon','Phoenix','Panda','Ninja','Rider','Coder','Sniper','Ranger','Hunter','Wizard','Knight','Pirate','Bandit','Nomad','Titan','Blade']

function addrName(address: string): string {
  const hex = address.replace(/^0x/i, '').toLowerCase()
  const a = parseInt(hex.slice(0, 4), 16) % ADJS.length
  const n = parseInt(hex.slice(4, 8), 16) % NOUNS.length
  const num = parseInt(hex.slice(8, 10), 16) % 100
  return `${ADJS[a]}${NOUNS[n]}${String(num).padStart(2, '0')}`
}

export function getUsername(address: string): string {
  if (!address) return 'Unknown'
  const key = `${P}un_${address.toLowerCase()}`
  return localStorage.getItem(key) || addrName(address)
}

export function setUsername(address: string, name: string) {
  localStorage.setItem(`${P}un_${address.toLowerCase()}`, name.trim().slice(0, 20))
}

export function getSavedStyle(address: string): string {
  return localStorage.getItem(`${P}style_${address.toLowerCase()}`) || 'adventurer'
}

export function setSavedStyle(address: string, style: string) {
  localStorage.setItem(`${P}style_${address.toLowerCase()}`, style)
}

export function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}
