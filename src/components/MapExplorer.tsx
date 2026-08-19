import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ArrowCounterClockwise,
  CheckCircle,
  GpsFix,
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
import { COUNTRY_BOUNDS, detectCountry, EUROPE_BOUNDS } from '../lib/geo'
import { marked } from '../lib/markdown'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Cottage } from '../types'

type MapExplorerProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  onOpenCode: () => void
}

type MapLevel = 'europa' | 'kraj' | 'kraina' | 'region' | 'szlak'

const LEVEL_KEYS: Record<MapLevel, string> = {
  europa: 'map.levelEuropa',
  kraj: 'map.levelKraj',
  kraina: 'map.levelKraina',
  region: 'map.levelRegion',
  szlak: 'map.levelSzlak',
}

const EUROPE = L.latLngBounds(EUROPE_BOUNDS)

const REGION_AREAS = [
  {
    labelKey: 'map.regionNorth',
    minLat: 50.35,
    points: [[50.43, 19.43], [50.42, 19.7], [50.35, 19.75], [50.34, 19.48]] as L.LatLngExpression[],
  },
  {
    labelKey: 'map.regionCentral',
    minLat: 50.27,
    points: [[50.35, 19.45], [50.35, 19.7], [50.27, 19.72], [50.26, 19.46]] as L.LatLngExpression[],
  },
  {
    labelKey: 'map.regionSouth',
    minLat: 0,
    points: [[50.27, 19.42], [50.28, 19.8], [50.15, 19.83], [50.15, 19.46]] as L.LatLngExpression[],
  },
]

/* The hand-drawn atlas area (region polygons + labels) — Jura-specific, so the
   presentation code shows it only when the view is actually over it. */
const ATLAS_BOUNDS = L.latLngBounds(REGION_AREAS.flatMap((region) => region.points as L.LatLngTuple[])).pad(0.35)

/* The Jura regions only make sense for the Polish cottages; a cottage abroad
   gets no region and the side panel shows its country name instead. */
function regionFor(cottage: Cottage) {
  if (cottage.country !== 'PL') return null
  return REGION_AREAS.find((region) => cottage.lat >= region.minLat) ?? REGION_AREAS[2]
}

function countryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function cottageIcon(pinImg: string | undefined, found: boolean, active: boolean) {
  const inner = pinImg
    ? `<img class="cottage-marker-img" src="${pinImg}" alt="" />`
    : renderToStaticMarkup(<HouseLine size={28} weight="fill" aria-hidden />)
  return L.divIcon({
    className: 'cottage-marker-shell',
    html: `<span class="cottage-marker${pinImg ? ' is-custom' : ''}${found ? ' is-found' : ''}${active ? ' is-active' : ''}">${inner}</span>`,
    iconSize: [52, 58],
    iconAnchor: [26, 46],
    tooltipAnchor: [0, -42],
  })
}

function createAtlas(map: L.Map, cottages: Cottage[], t: TFunction) {
  const group = L.layerGroup().addTo(map)
  REGION_AREAS.forEach((region, index) => {
    const matching = cottages.filter((cottage) => regionFor(cottage)?.labelKey === region.labelKey)
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
        html: `<button type="button" class="region-label"><strong>${t(region.labelKey)}</strong><span>${t('map.regionCottages', { count: matching.length })}</span></button>`,
      }),
    }).addTo(group)
    marker.on('click', () => map.flyTo(center, Math.max(map.getMinZoom() + 1, 11.5), { duration: 1.15 }))
  })
  return group
}

export function MapExplorer({ cottages, foundSlugs, onOpenCode }: MapExplorerProps) {
  const { t, i18n } = useTranslation()
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
  const [searchMissed, setSearchMissed] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const userLocationRef = useRef<L.LayerGroup | null>(null)
  const levelForZoomRef = useRef<(zoom: number) => MapLevel>(() => 'kraina')
  const [touchMapActive, setTouchMapActive] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  /* The country whose cottages the map opens on: the visitor's country when it
     has cottages (detected from the browser's languages — never geolocation),
     otherwise the only country in the data, otherwise none (Europe overview). */
  const homeCountry = useMemo(() => {
    const present = new Set(cottages.map((cottage) => cottage.country))
    const detected = detectCountry()
    if (detected && present.has(detected)) return detected
    return present.size === 1 ? [...present][0] : null
  }, [cottages])
  /* The "whole country" frame the map opens and resets to. Countries without a
     preset box (and the no-country Europe overview) frame their cottages. */
  const homeBounds = useMemo(() => {
    const preset = homeCountry ? COUNTRY_BOUNDS[homeCountry] : undefined
    if (preset) return L.latLngBounds(preset)
    const own = homeCountry ? cottages.filter((cottage) => cottage.country === homeCountry) : cottages
    return L.latLngBounds(own.map((cottage) => [cottage.lat, cottage.lng] as L.LatLngTuple)).pad(0.24)
  }, [cottages, homeCountry])
  // Lookup so the setIcon loops (which iterate markers by slug) can find each
  // cottage's optional custom pin image without re-scanning the array.
  const cottageBySlug = useMemo(() => new Map(cottages.map((cottage) => [cottage.slug, cottage])), [cottages])

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
      marker.setIcon(cottageIcon(cottageBySlug.get(slug)?.pin_custom_img, foundSlugs.has(slug), slug === cottage.slug))
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
  }, [clearArea, cottageBySlug, foundSlugs])

  const closeCottage = useCallback(() => {
    selectedRef.current = null
    setSelected(null)
    clearArea()
    markersRef.current.forEach((marker, slug) => marker.setIcon(cottageIcon(cottageBySlug.get(slug)?.pin_custom_img, foundSlugs.has(slug), false)))
    const zoom = mapRef.current?.getZoom() ?? 9
    setLevel(levelForZoomRef.current(zoom))
  }, [clearArea, cottageBySlug, foundSlugs])

  const resetMap = useCallback(() => {
    closeCottage()
    mapRef.current?.flyToBounds(homeBounds, { animate: true, duration: 1.15 })
  }, [homeBounds, closeCottage])

  /* Geolocation is requested here and only here — the browser's permission
     prompt appears the first time the visitor presses the locate button,
     never on page load. */
  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocateError('map.locateUnsupported')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        const map = mapRef.current
        if (!map) return
        const where = L.latLng(position.coords.latitude, position.coords.longitude)
        userLocationRef.current?.removeFrom(map)
        userLocationRef.current = null
        if (!EUROPE.contains(where)) {
          setLocateError('map.locateOutside')
          return
        }
        userLocationRef.current = L.layerGroup([
          L.circle(where, {
            pane: 'searchArea',
            radius: Math.max(position.coords.accuracy, 25),
            className: 'user-location-accuracy',
            color: '#4d90d2',
            fillColor: '#4d90d2',
            weight: 1,
            opacity: 0.6,
            fillOpacity: 0.12,
          }),
          L.marker(where, {
            pane: 'searchArea',
            keyboard: false,
            icon: L.divIcon({
              className: 'user-location-shell',
              html: '<span class="user-location-dot"></span>',
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            }),
          }).bindTooltip(t('map.youAreHere'), { direction: 'top', offset: [0, -12], className: 'fantasy-tooltip' }),
        ]).addTo(map)
        map.flyTo(where, Math.max(map.getZoom(), 14), { duration: 1.3 })
      },
      (error) => {
        setLocating(false)
        setLocateError(error.code === error.PERMISSION_DENIED ? 'map.locateDenied' : 'map.locateFail')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }, [t])

  useEffect(() => {
    if (!locateError) return
    const timer = window.setTimeout(() => setLocateError(null), 6000)
    return () => window.clearTimeout(timer)
  }, [locateError])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 3,
      maxZoom: 18,
      maxBounds: EUROPE.pad(0.08),
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
      minZoom: 3,
      maxZoom: 18,
      noWrap: true,
      keepBuffer: 2,
      className: 'base-map-tiles',
    }).addTo(map)
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
    createAtlas(map, cottages, t)

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
        icon: cottageIcon(cottage.pin_custom_img, foundSlugs.has(cottage.slug), false),
        keyboard: true,
        riseOnHover: true,
        title: t('map.openMarker', { title: cottage.title }),
      })
        .bindTooltip(cottage.title, { direction: 'top', offset: [0, -40], className: 'fantasy-tooltip' })
        .on('click', () => chooseCottage(cottage))
      clusters.addLayer(marker)
      markersRef.current.set(cottage.slug, marker)
    })

    /* Zoom tiers, recomputed on resize: the map floor fits Europe, the kraj
       tier starts where the home country fills the view, and the atlas band —
       kraina, the enchanted land itself — brackets the zooms where the
       hand-drawn Jura regions fill the view (the map's only reachable range
       before the multi-country expansion). Without a home country there is no
       kraj rung and the ladder goes straight from europa to kraina. */
    let krajMinZoom = 7
    let atlasMinZoom = 8
    let atlasMaxZoom = 10.5
    const levelForZoom = (zoom: number): MapLevel => {
      if (zoom < krajMinZoom - 0.45) return 'europa'
      if (zoom < atlasMinZoom) return homeCountry ? 'kraj' : 'europa'
      if (zoom <= atlasMaxZoom) return 'kraina'
      return zoom < 13.5 ? 'region' : 'szlak'
    }
    levelForZoomRef.current = levelForZoom
    const updatePresentation = () => {
      const zoom = map.getZoom()
      const reality = Math.max(0, Math.min(1, (zoom - 9) / 4))
      container.style.setProperty('--map-reality', reality.toFixed(3))
      const nextLevel = levelForZoom(zoom)
      container.dataset.level = nextLevel
      /* The fixed-size region labels are legible only while the Jura atlas
         area fills the view; at country/Europe zooms — and anywhere outside
         the atlas — the clustered markers tell the story instead. */
      const atlasVisible = zoom >= atlasMinZoom && zoom <= atlasMaxZoom && ATLAS_BOUNDS.contains(map.getCenter())
      container.dataset.atlas = atlasVisible ? 'on' : 'off'
      setCanZoomOut(zoom > map.getMinZoom() + 0.01)
      setCanZoomIn(zoom < map.getMaxZoom() - 0.01)
      if (!selectedRef.current) setLevel(nextLevel)
    }
    const syncZoomTiers = () => {
      const padding = L.point(container.clientWidth < 760 ? 32 : 64, container.clientWidth < 760 ? 80 : 64)
      const nextMinimum = Math.max(3, map.getBoundsZoom(EUROPE, false, padding))
      map.setMinZoom(nextMinimum)
      krajMinZoom = Math.max(nextMinimum, map.getBoundsZoom(homeBounds, false, padding))
      const atlasFit = map.getBoundsZoom(ATLAS_BOUNDS, false, padding)
      atlasMinZoom = Math.max(krajMinZoom + 0.5, atlasFit - 1.4)
      atlasMaxZoom = atlasFit + 0.55
      if (map.getZoom() < nextMinimum) map.setZoom(nextMinimum, { animate: false })
    }
    map.on('zoom', updatePresentation)
    map.on('zoomend', updatePresentation)
    map.on('moveend', updatePresentation)
    map.fitBounds(homeBounds, { animate: false, padding: [48, 48] })
    syncZoomTiers()
    updatePresentation()

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
      syncZoomTiers()
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
      userLocationRef.current = null
    }
    // The region labels and marker titles are markup injected into Leaflet, so
    // the whole map is rebuilt when the interface language changes.
  }, [homeBounds, homeCountry, chooseCottage, cottages, foundSlugs, i18n.resolvedLanguage, t])

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

  /* Cottages reload when the language changes — an open side panel must show
     the freshly loaded copy of the same cottage, not the stale one. */
  useEffect(() => {
    const current = selectedRef.current
    if (!current) return
    const refreshed = cottages.find((cottage) => cottage.slug === current.slug)
    if (refreshed && refreshed !== current) {
      selectedRef.current = refreshed
      setSelected(refreshed)
    }
  }, [cottages])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const locale = i18n.resolvedLanguage ?? 'pl'
    const normalized = query.trim().toLocaleLowerCase(locale)
    const match = cottages.find((cottage) => cottage.title.toLocaleLowerCase(locale).includes(normalized))
    if (!normalized || !match) {
      setSearchMissed(true)
      return
    }
    setSearchMissed(false)
    chooseCottage(match)
  }

  const selectedRegion = selected ? regionFor(selected) : null

  return (
    <div className={`map-explorer${selected ? ' has-selection' : ''}${touchMapActive ? '' : ' is-touch-locked'}`}>
      <div ref={containerRef} className="fantasy-map" aria-label={t('map.interactiveAria')} />
      <div className="map-vignette" aria-hidden="true" />

      {!touchMapActive && (
        <button className="map-touch-shield" type="button" onClick={() => setTouchMapActive(true)}>
          <span><MapPin size={24} weight="fill" /> {t('map.enable')}</span>
          <small>{t('map.enableHint')}</small>
        </button>
      )}
      {touchMapActive && <button className="map-touch-exit" type="button" onClick={() => setTouchMapActive(false)}>{t('map.exitTouch')}</button>}

      <div className="map-topbar">
        <div className="map-level" aria-live="polite">
          <span>{t('map.levelLabel')}</span>
          <strong>{t(LEVEL_KEYS[level])}</strong>
        </div>
        <form className="map-search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="map-search-input">{t('map.searchLabel')}</label>
          <MagnifyingGlass size={20} aria-hidden />
          <input
            id="map-search-input"
            list="cottage-names"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('map.searchLabel')}
          />
          <datalist id="cottage-names">
            {cottages.map((cottage) => <option key={cottage.slug} value={cottage.title} />)}
          </datalist>
          <button type="submit">{t('map.searchSubmit')}</button>
        </form>
      </div>

      {searchMissed && <p className="map-search-error" role="alert">{t('map.searchMiss')}</p>}
      {locateError && <p className="map-search-error" role="alert">{t(locateError)}</p>}

      <nav className="map-controls" aria-label={t('map.controlsAria')}>
        <button type="button" disabled={!canZoomIn} onClick={() => mapRef.current?.zoomIn(0.5)} aria-label={t('map.zoomIn')}><Plus size={20} /></button>
        <button type="button" disabled={!canZoomOut} onClick={() => mapRef.current?.zoomOut(0.5)} aria-label={t('map.zoomOut')}><Minus size={20} /></button>
        <button type="button" onClick={resetMap} aria-label={t('map.resetView')}><ArrowCounterClockwise size={20} /></button>
        <button type="button" onClick={locateMe} disabled={locating} aria-busy={locating} aria-label={t('map.locate')}><GpsFix size={20} /></button>
      </nav>

      <div className="map-legend" aria-label={t('map.legendAria')}>
        <span><HouseLine size={18} weight="fill" /> {t('map.legendCottage')}</span>
        <span><CheckCircle size={18} weight="fill" /> {t('map.legendFound')}</span>
        <span><i className="legend-area" /> {t('map.legendArea')}</span>
      </div>

      {!selected && (
        <p className="map-tip"><MagnifyingGlass size={18} aria-hidden /> {t('map.tip')}</p>
      )}

      {selected && (
        <aside className="cottage-panel" aria-label={t('map.panelAria', { title: selected.title })}>
          <div className="cottage-panel-handle" aria-hidden="true" />
          <button type="button" className="icon-button panel-close" onClick={closeCottage} aria-label={t('map.closePanel')}><X size={20} /></button>
          <p className="cottage-region">
            {selectedRegion ? t(selectedRegion.labelKey) : countryName(selected.country, i18n.resolvedLanguage ?? 'pl')}
          </p>
          <h3>{selected.title}</h3>
          <p className="cottage-resident">{t('map.residentPrefix')} <strong>{selected.occupant || t('map.defaultOccupant')}</strong></p>
          {foundSlugs.has(selected.slug) ? (
            <p className="found-notice"><CheckCircle size={20} weight="fill" /> {t('map.alreadyInTreasury')}</p>
          ) : (
            <p className="cottage-clue">{t('map.clue')}</p>
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
              <NavigationArrow size={20} weight="fill" /> {t('map.navigate')}
            </a>
            <button type="button" className="button button-ghost" onClick={onOpenCode}>
              <MapPin size={20} /> {t('map.haveCode')}
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
