const P = 'ag_'

export function getUsername(address: string): string {
  const key = `${P}un_${address.toLowerCase()}`
  return localStorage.getItem(key) || shortAddr(address)
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
