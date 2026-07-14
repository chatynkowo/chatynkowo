export type CottageLocation = {
  slug: string
  lat: number
  lng: number
  mapX: number
  mapY: number
}

export type Cottage = CottageLocation & {
  title: string
  occupant: string
  virtue: string
  storyMarkdown: string
  arrivalMarkdown: string
}

export type BadgeDefinition = {
  id: string
  name: string
  description: string
  threshold?: number
  final?: boolean
}

export type StoredFind = {
  foundAt: string
  code?: string
}

export type StoredState = {
  version: 1
  found: Record<string, StoredFind>
  badges: Record<string, { earnedAt: string }>
}
