import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ArrowCounterClockwise,
  CheckCircle,
  HouseLine,
  MagnifyingGlass,
  MapPin,
  Minus,
  NavigationArrow,
  Plus,
  X,
} from '@phosphor-icons/react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { marked } from 'marked'
import type { Cottage } from '../types'

type MapExplorerProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  onOpenCode: () => void
}

type MapLevel = 'kraina' | 'region' | 'szlak'

const LEVEL_LABELS: Record<MapLevel, string> = {
  kraina: 'Kraina',
  region: 'Okolica',
  szlak: 'Szlak',
}

const REGION_AREAS = [
  {
    name: 'Północna Jura',
    minLat: 50.35,
    points: [[50.43, 19.43], [50.42, 19.7], [50.35, 19.75], [50.34, 19.48]] as L.LatLngExpression[],
  },
  {
    name: 'Środkowa Jura',
    minLat: 50.27,
    points: [[50.35, 19.45], [50.35, 19.7], [50.27, 19.72], [50.26, 19.46]] as L.LatLngExpression[],
  },
  {
    name: 'Południowa Jura',
    minLat: 0,
    points: [[50.27, 19.42], [50.28, 19.8], [50.15, 19.83], [50.15, 19.46]] as L.LatLngExpression[],
  },
]

function regionFor(cottage: Cottage) {
  return REGION_AREAS.find((region) => cottage.lat >= region.minLat) ?? REGION_AREAS[2]
}

function cottageIcon(found: boolean, active: boolean) {
  const house = renderToStaticMarkup(<HouseLine size={28} weight="fill" aria-hidden />)
  return L.divIcon({
    className: 'cottage-marker-shell',
    html: `<span class="cottage-marker${found ? ' is-found' : ''}${active ? ' is-active' : ''}">${house}</span>`,
    iconSize: [52, 58],
    iconAnchor: [26, 46],
    tooltipAnchor: [0, -42],
  })
}

function createAtlas(map: L.Map, cottages: Cottage[]) {
  const group = L.layerGroup().addTo(map)
  REGION_AREAS.forEach((region, index) => {
    const matching = cottages.filter((cottage) => regionFor(cottage).name === region.name)
    L.polygon(region.points, {
      pane: 'atlas',
      className: `atlas-area atlas-area-${index + 1}`,
      color: '#775c32',
      weight: 2,
      opacity: 0.76,
      dashArray: '4 10',
      fillOpacity: 0.18,
      interactive: false,
    }).addTo(group)

    const center = L.polygon(region.points).getBounds().getCenter()
    const marker = L.marker(center, {
      pane: 'regionLabels',
      icon: L.divIcon({
        className: 'region-label-shell',
        iconSize: [190, 64],
        iconAnchor: [95, 32],
        html: `<button type="button" class="region-label"><strong>${region.name}</strong><span>${matching.length} Chatynek</span></button>`,
      }),
    }).addTo(group)
    marker.on('click', () => map.flyTo(center, Math.max(map.getMinZoom() + 1, 11.5), { duration: 1.15 }))
  })
  return group
}

export function MapExplorer({ cottages, foundSlugs, onOpenCode }: MapExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const searchAreaRef = useRef<L.Circle | null>(null)
  const [selected, setSelected] = useState<Cottage | null>(null)
  const selectedRef = useRef<Cottage | null>(null)
  const [level, setLevel] = useState<MapLevel>('kraina')
  const [canZoomIn, setCanZoomIn] = useState(true)
  const [canZoomOut, setCanZoomOut] = useState(false)
  const [query, setQuery] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [touchMapActive, setTouchMapActive] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const bounds = useMemo(
    () => L.latLngBounds(cottages.map((cottage) => [cottage.lat, cottage.lng] as L.LatLngTuple)).pad(0.24),
    [cottages],
  )

  const clearArea = useCallback(() => {
    if (searchAreaRef.current && mapRef.current) searchAreaRef.current.removeFrom(mapRef.current)
    searchAreaRef.current = null
  }, [])

  const chooseCottage = useCallback((cottage: Cottage) => {
    const map = mapRef.current
    if (!map) return
    clearArea()
    selectedRef.current = cottage
    setSelected(cottage)
    setLevel('szlak')
    markersRef.current.forEach((marker, slug) => {
      marker.setIcon(cottageIcon(foundSlugs.has(slug), slug === cottage.slug))
    })
    searchAreaRef.current = L.circle([cottage.lat, cottage.lng], {
      pane: 'searchArea',
      radius: 360,
      className: 'search-area',
      color: '#d2a64d',
      fillColor: '#d2a64d',
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0.12,
      dashArray: '8 8',
    }).addTo(map)
    const mobile = window.matchMedia('(max-width: 760px)').matches
    map.flyToBounds(searchAreaRef.current.getBounds(), {
      animate: true,
      duration: 1.2,
      maxZoom: 14.2,
      paddingTopLeft: [28, 88],
      paddingBottomRight: mobile ? [24, 320] : [420, 40],
    })
  }, [clearArea, foundSlugs])

  const closeCottage = useCallback(() => {
    selectedRef.current = null
    setSelected(null)
    clearArea()
    markersRef.current.forEach((marker, slug) => marker.setIcon(cottageIcon(foundSlugs.has(slug), false)))
    const zoom = mapRef.current?.getZoom() ?? 9
    setLevel(zoom < 10.5 ? 'kraina' : 'region')
  }, [clearArea, foundSlugs])

  const resetMap = useCallback(() => {
    closeCottage()
    mapRef.current?.flyToBounds(bounds, { animate: true, duration: 1.15 })
  }, [bounds, closeCottage])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 5,
      maxZoom: 18,
      maxBounds: bounds.pad(0.42),
      maxBoundsViscosity: 0.82,
      keyboard: true,
      scrollWheelZoom: true,
    })
    mapRef.current = map

    ;([
      ['atlas', 260],
      ['searchArea', 360],
      ['regionLabels', 410],
      ['cottages', 450],
    ] as const).forEach(([name, zIndex]) => {
      const pane = map.createPane(name)
      pane.style.zIndex = String(zIndex)
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      minZoom: 5,
      maxZoom: 18,
      noWrap: true,
      keepBuffer: 2,
      className: 'base-map-tiles',
    }).addTo(map)
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
    createAtlas(map, cottages)

    const clusters = L.markerClusterGroup({
      maxClusterRadius: (zoom) => (zoom < 11 ? 74 : 48),
      disableClusteringAtZoom: 15,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      animate: true,
      clusterPane: 'cottages',
      iconCreateFunction(cluster) {
        const house = renderToStaticMarkup(<HouseLine size={20} weight="fill" aria-hidden />)
        return L.divIcon({
          className: 'cottage-cluster-shell',
          html: `<span class="cottage-cluster">${house}<strong>${cluster.getChildCount()}</strong></span>`,
          iconSize: [58, 58],
          iconAnchor: [29, 29],
        })
      },
    }).addTo(map)

    cottages.forEach((cottage) => {
      const marker = L.marker([cottage.lat, cottage.lng], {
        pane: 'cottages',
        icon: cottageIcon(foundSlugs.has(cottage.slug), false),
        keyboard: true,
        riseOnHover: true,
        title: `Otwórz ${cottage.title}`,
      })
        .bindTooltip(cottage.title, { direction: 'top', offset: [0, -40], className: 'fantasy-tooltip' })
        .on('click', () => chooseCottage(cottage))
      clusters.addLayer(marker)
      markersRef.current.set(cottage.slug, marker)
    })

    let krainaMaxZoom = 10.5
    const updatePresentation = () => {
      const zoom = map.getZoom()
      const reality = Math.max(0, Math.min(1, (zoom - 9) / 4))
      container.style.setProperty('--map-reality', reality.toFixed(3))
      const nextLevel = zoom <= krainaMaxZoom ? 'kraina' : zoom < 13.5 ? 'region' : 'szlak'
      container.dataset.level = nextLevel
      setCanZoomOut(zoom > map.getMinZoom() + 0.01)
      setCanZoomIn(zoom < map.getMaxZoom() - 0.01)
      if (!selectedRef.current) setLevel(nextLevel)
    }
    const syncMinimumZoom = () => {
      const padding = L.point(container.clientWidth < 760 ? 32 : 64, container.clientWidth < 760 ? 80 : 64)
      const nextMinimum = Math.max(8, map.getBoundsZoom(bounds, false, padding))
      map.setMinZoom(nextMinimum)
      krainaMaxZoom = nextMinimum + 0.55
      if (map.getZoom() < nextMinimum) map.setZoom(nextMinimum, { animate: false })
    }
    map.on('zoom', updatePresentation)
    map.on('zoomend', updatePresentation)
    map.fitBounds(bounds, { animate: false, padding: [48, 48] })
    syncMinimumZoom()
    updatePresentation()

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
      syncMinimumZoom()
      updatePresentation()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map.off()
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
      searchAreaRef.current = null
    }
  }, [bounds, chooseCottage, cottages, foundSlugs])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.matchMedia('(max-width: 760px)').matches) return
    const method = touchMapActive ? 'enable' : 'disable'
    map.dragging[method]()
    map.touchZoom[method]()
    map.doubleClickZoom[method]()
    map.scrollWheelZoom.disable()
  }, [touchMapActive])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const handleBreakpoint = (event: MediaQueryListEvent) => setTouchMapActive(!event.matches)
    query.addEventListener('change', handleBreakpoint)
    return () => query.removeEventListener('change', handleBreakpoint)
  }, [])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const normalized = query.trim().toLocaleLowerCase('pl')
    const match = cottages.find((cottage) => cottage.title.toLocaleLowerCase('pl').includes(normalized))
    if (!normalized || !match) {
      setSearchMessage('Nie znaleźliśmy takiej Chatynki. Wybierz nazwę z listy.')
      return
    }
    setSearchMessage('')
    chooseCottage(match)
  }

  return (
    <div className={`map-explorer${selected ? ' has-selection' : ''}${touchMapActive ? '' : ' is-touch-locked'}`}>
      <div ref={containerRef} className="fantasy-map" aria-label="Interaktywna mapa Chatynkowa" />
      <div className="map-vignette" aria-hidden="true" />

      {!touchMapActive && (
        <button className="map-touch-shield" type="button" onClick={() => setTouchMapActive(true)}>
          <span><MapPin size={24} weight="fill" /> Włącz mapę</span>
          <small>Wtedy możesz ją przesuwać i wybierać tropy</small>
        </button>
      )}
      {touchMapActive && <button className="map-touch-exit" type="button" onClick={() => setTouchMapActive(false)}>Zakończ sterowanie mapą</button>}

      <div className="map-topbar">
        <div className="map-level" aria-live="polite">
          <span>Poziom mapy</span>
          <strong>{LEVEL_LABELS[level]}</strong>
        </div>
        <form className="map-search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="map-search-input">Wyszukaj Chatynkę</label>
          <MagnifyingGlass size={20} aria-hidden />
          <input
            id="map-search-input"
            list="cottage-names"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Wyszukaj Chatynkę"
          />
          <datalist id="cottage-names">
            {cottages.map((cottage) => <option key={cottage.slug} value={cottage.title} />)}
          </datalist>
          <button type="submit">Pokaż</button>
        </form>
      </div>

      {searchMessage && <p className="map-search-error" role="alert">{searchMessage}</p>}

      <nav className="map-controls" aria-label="Sterowanie mapą">
        <button type="button" disabled={!canZoomIn} onClick={() => mapRef.current?.zoomIn(0.5)} aria-label="Przybliż mapę"><Plus size={20} /></button>
        <button type="button" disabled={!canZoomOut} onClick={() => mapRef.current?.zoomOut(0.5)} aria-label="Oddal mapę"><Minus size={20} /></button>
        <button type="button" onClick={resetMap} aria-label="Pokaż całą krainę"><ArrowCounterClockwise size={20} /></button>
      </nav>

      <div className="map-legend" aria-label="Legenda mapy">
        <span><HouseLine size={18} weight="fill" /> Chatynka</span>
        <span><CheckCircle size={18} weight="fill" /> Odkryta</span>
        <span><i className="legend-area" /> Obszar poszukiwań</span>
      </div>

      {!selected && (
        <p className="map-tip"><MagnifyingGlass size={18} aria-hidden /> Przybliż mapę lub wybierz jeden z punktów.</p>
      )}

      {selected && (
        <aside className="cottage-panel" aria-label={`Informacje o ${selected.title}`}>
          <div className="cottage-panel-handle" aria-hidden="true" />
          <button type="button" className="icon-button panel-close" onClick={closeCottage} aria-label="Zamknij panel"><X size={20} /></button>
          <p className="cottage-region">{regionFor(selected).name}</p>
          <h3>{selected.title}</h3>
          <p className="cottage-resident">Mieszka tu <strong>{selected.occupant || 'Elf'}</strong></p>
          {foundSlugs.has(selected.slug) ? (
            <p className="found-notice"><CheckCircle size={20} weight="fill" /> Ta opowieść jest już w Twoim Skarbcu.</p>
          ) : (
            <p className="cottage-clue">Na miejscu odszukaj tabliczkę z czterocyfrowym kodem. Dopiero wtedy opowieść stanie się dostępna.</p>
          )}
          {selected.arrivalMarkdown && (
            <div className="arrival-guide" dangerouslySetInnerHTML={{ __html: marked.parse(selected.arrivalMarkdown) as string }} />
          )}
          <div className="cottage-panel-actions">
            <a
              className="button button-primary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <NavigationArrow size={20} weight="fill" /> Nawiguj
            </a>
            <button type="button" className="button button-ghost" onClick={onOpenCode}>
              <MapPin size={20} /> Mam kod
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
