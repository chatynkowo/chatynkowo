export type CottageLocation = {
  slug: string
  lat: number
  lng: number
  /* File names inside assets/img/cottages/<slug>/, written by the admin editor.
     The site is a static bundle with no directory listing, so the manifest in
     data/cottages.json is the only way to know which photos exist. */
  photos?: string[]
}

export type Cottage = CottageLocation & {
  title: string
  occupant: string
  virtue: string
  storyMarkdown: string
  arrivalMarkdown: string
}

/* One collectible reward card in the Kronika, authored in /admin/ → Nagrody and
   published as data/rewards.json. `threshold` is the number of discovered
   cottages that unlocks it; `final: true` means the full set instead (the
   cottage total is dynamic) and unlocks the ranking invite. */
export type RewardLevel = {
  id: string
  name: string
  threshold: number | null
  final: boolean
  image: string
  body: string
}

export type TreasuryConfig = {
  title: string
  intro: string
  image: string
}

export type RewardsConfig = {
  treasury: TreasuryConfig
  levels: RewardLevel[]
}

export type StoredFind = {
  foundAt: string
  code?: string
}

export type StoredState = {
  version: 1
  found: Record<string, StoredFind>
  badges: Record<string, { earnedAt: string; name?: string }>
}
