import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { fetchProfile } from '../utils/supabase'
import { setUsername } from '../utils/profile'

/**
 * On wallet connect, fetches profile from Supabase and syncs to localStorage cache.
 * This ensures username + avatar style are correct on any device without visiting Profile.
 */
export function useProfileSync() {
  const { address } = useAccount()

  useEffect(() => {
    if (!address) return
    fetchProfile(address).then(profile => {
      if (!profile) return
      if (profile.username) setUsername(address, profile.username)
      if (profile.avatar_style) localStorage.setItem(`ag_style_${address.toLowerCase()}`, profile.avatar_style)
    }).catch(() => {})
  }, [address])
}
