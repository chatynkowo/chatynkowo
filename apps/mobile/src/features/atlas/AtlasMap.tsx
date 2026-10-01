import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, type NativeSyntheticEvent } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { getLocales } from 'expo-localization'
import Supercluster from 'supercluster'
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  Marker,
  type CameraRef,
  type LngLatBounds,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import { bearingDegrees, boundsAround, COUNTRY_BOUNDS, countryAt, detectCountry, EUROPE_BOUNDS, homeBounds, homeCountry, isWithinBounds, nearestPlace, type BoundsTuple, type Cottage, type LatLng } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import type { Position } from '../../lib/location'
import { mapPalette, space } from '../../ui'
import { ClusterBadge, CottagePin, UserDot } from './pins'

/* The expedition map, drawn after the site's: OpenStreetMap tiles washed
   into parchment that turn real as the seeker zooms in, teardrop pins that
   gather into clusters, a search area around the chosen cottage and the
   seeker's own dot. It fills the Atlas screen; the screen owns the floating
   chrome and the cottage sheet. The map reports the level rung as a string
   and drives the vignette's glow through a shared value, so panning never
   re-renders the screen; clusters recompute once the view has settled. */

export type MapLevel = 'europa' | 'kraj' | 'region' | 'szlak'

export const LEVEL_KEYS: Record<MapLevel, string> = {
  europa: 'map.levelEuropa',
  kraj: 'map.levelKraj',
  region: 'map.levelRegion',
  szlak: 'map.levelSzlak',
}

export type FrameMode = 'ease' | 'fly'

/* The nearest cottage when none is in view: how far from the middle of
   the view and in which direction (degrees clockwise from north, which the
   map keeps at the top: it does not rotate). */
export type OutOfSight = { cottage: Cottage; distanceKm: number; heading: number }

export type AtlasMapHandle = {
  resetView: () => void
  showPosition: (position: LatLng) => void
  /* Frame the seeker with the nearest cottage (or alone), never closer
     than the neighbourhood around them; not once the seeker has moved the
     map themselves or framed a cottage. */
  arriveAt: (seeker: LatLng, nearest: LatLng | null) => void
  /* Frame the search area of a cottage, leaving room for the sheet below;
     `fly` arcs over the distance when the target is out of view. */
  frameCottage: (cottage: LatLng, bottomPadding: number, mode?: FrameMode) => void
  /* The sheet settled on a new snap: move the camera's room accordingly. */
  setBottomPadding: (px: number) => void
  /* The sheet is gone: same centre, no padding, one ease. */
  recentre: () => void
  /* Whether a point lies inside the current view. */
  isInView: (point: LatLng) => boolean
}

type AtlasMapProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  selectedSlug: string | null
  /* The cottage found moments ago, whose pin crossfades to the found look. */
  justFoundSlug: string | null
  userPosition: Position | null
  /* Room for the screen's bottom chrome; keeps the attribution above it. */
  bottomInset: number
  onSelect: (cottage: Cottage) => void
  /* A press on the map itself (not on a marker). */
  onMapPress: () => void
  onLevelChange: (level: MapLevel) => void
  /* The view settled with no cottage in it: the nearest one and where it
     lies; null once a cottage is in view again. */
  onOutOfSight: (target: OutOfSight | null) => void
  /* 0 at the parchment zooms, 1 once the tiles show the real land. */
  reality: SharedValue<number>
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const FRAME_PADDING = { top: 48, right: 48, bottom: 48, left: 48 }
/* How far around the seeker the arrival frame reaches at least, in km. */
const ARRIVAL_RADIUS_KM = 1
/* The least radius drawn for the position's accuracy circle, in metres,
   so a precise fix still shows a ring. */
const MIN_ACCURACY_M = 25
/* A frame of a whole land (the reset, the arrival) and the zoom into a
   cluster. */
const FIT_MS = 900
const CLUSTER_MS = 800
/* Android draws marker views in the order they reach the map, so the
   targets are raised above the seeker's dot; iOS orders markers by
   latitude unless told otherwise, and the dot alone is told. */
const PIN_STYLE = Platform.select({ android: { zIndex: 1 } })
const COTTAGE_PADDING = { top: 40, left: 24, right: 24 }
const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 }
const SEARCH_AREA_RADIUS_M = 360

/* MapLibre numbers zooms for 512 px tiles, so its zoom is one below the
   256 px scale of OpenStreetMap, Leaflet and supercluster. Every zoom in
   this file is written in the tile scale (the site's numbers) and
   converted at the camera and the style expressions. */
const TILE_ZOOM_OFFSET = 1
const toMapZoom = (tileZoom: number) => tileZoom - TILE_ZOOM_OFFSET
const toTileZoom = (mapZoom: number) => mapZoom + TILE_ZOOM_OFFSET

const COTTAGE_ZOOM = 14
const POSITION_ZOOM = 14
/* From this zoom the view is a neighbourhood rather than a country, and
   from TRAIL_ZOOM a single trail, the same rungs as the site. */
const REGION_ZOOM = 9.5
const TRAIL_ZOOM = 13.5
/* Where the kraj rung starts over the sea or outside the country presets. */
const DEFAULT_KRAJ_ZOOM = 5.5
/* The tiles turn from parchment to the real land between these zooms. */
const REALITY_FROM = 9
const REALITY_TO = 13
const CLUSTER_RADIUS = 70
const CLUSTERS_UNTIL_ZOOM = 14

/* The map style: the parchment ground and the OpenStreetMap tiles washed
   into it live in the style itself rather than as JSX layers, because a
   raster layer declared through the library's components never renders on
   iOS (no tile is ever requested). Everything drawn over them (the tint,
   the search area, the accuracy circle) stays JSX and is added on top. The
   zoom stops are in MapLibre's 512 px scale. */
const MAP_STYLE: StyleSpecification = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: [OSM_TILES], tileSize: 256, maxzoom: 19, attribution: 'OpenStreetMap contributors' },
  },
  layers: [
    { id: 'parchment', type: 'background' as const, paint: { 'background-color': mapPalette.parchment } },
    {
      id: 'osm-tiles',
      type: 'raster' as const,
      source: 'osm',
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], toMapZoom(REALITY_FROM), 0.5, toMapZoom(REALITY_TO), 1],
        'raster-saturation': ['interpolate', ['linear'], ['zoom'], toMapZoom(REALITY_FROM), -0.45, toMapZoom(REALITY_TO), -0.05],
        'raster-contrast': ['interpolate', ['linear'], ['zoom'], toMapZoom(REALITY_FROM), -0.09, toMapZoom(REALITY_TO), -0.01],
        'raster-brightness-max': ['interpolate', ['linear'], ['zoom'], toMapZoom(REALITY_FROM), 0.83, toMapZoom(REALITY_TO), 0.98],
      },
    },
  ],
}

/* Camera timings. */
const EASE_MS = 1000
const FLY_MS = 1400
const PADDING_MS = 250
const RECENTRE_MS = 600
/* The view settles before clusters recompute. */
const VIEW_DEBOUNCE_MS = 100
/* A map press right after a marker press is the same finger; ignore it. */
const MARKER_PRESS_GUARD_MS = 150

function toLngLatBounds([[south, west], [north, east]]: BoundsTuple): LngLatBounds {
  return [west, south, east, north]
}

const EUROPE = toLngLatBounds(EUROPE_BOUNDS)

/* The view as the map reports it, with the zoom already in the tile scale. */
type View = { zoom: number; bounds: LngLatBounds; center: LatLng }

/* The zoom at which a box fills the viewport's longer side, measured from
   the current view's own spans (exact enough over these areas). The longer
   side, not the shorter: on a phone a country spans the width long before
   it fills the screen, and the view still shows its neighbours. */
function fillZoom(view: View, [[south, west], [north, east]]: BoundsTuple): number {
  const [viewWest, viewSouth, viewEast, viewNorth] = view.bounds
  const ratio = Math.max((viewNorth - viewSouth) / (north - south), (viewEast - viewWest) / (east - west))
  return view.zoom + Math.log2(ratio)
}

/* The level indicator describes what the view shows: europa until the
   country under the view's centre fills the viewport, kraj from there,
   then a neighbourhood, then a single trail. The kraj threshold is the
   fill zoom of that country's box, measured from the viewport the same way
   the site measures it. */
function krajMinFor(view: View): number {
  const country = countryAt(view.center)
  return country ? fillZoom(view, COUNTRY_BOUNDS[country]) - 0.2 : DEFAULT_KRAJ_ZOOM
}

function levelForZoom(zoom: number, krajMin: number): MapLevel {
  if (zoom < krajMin - 0.45) return 'europa'
  if (zoom < REGION_ZOOM) return 'kraj'
  return zoom < TRAIL_ZOOM ? 'region' : 'szlak'
}

function realityForZoom(zoom: number): number {
  return Math.max(0, Math.min(1, (zoom - REALITY_FROM) / (REALITY_TO - REALITY_FROM)))
}

function toView(event: ViewStateChangeEvent): View {
  return { zoom: toTileZoom(event.zoom), bounds: event.bounds, center: { lng: event.center[0], lat: event.center[1] } }
}

/* A circle of `radiusMetres` around a point as a polygon ring. */
function circleRing({ lat, lng }: LatLng, radiusMetres: number, steps = 64): GeoJSON.Position[] {
  const latDegrees = radiusMetres / 111_320
  const lngDegrees = radiusMetres / (111_320 * Math.cos((lat * Math.PI) / 180))
  const ring: GeoJSON.Position[] = []
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * 2 * Math.PI
    ring.push([lng + lngDegrees * Math.cos(angle), lat + latDegrees * Math.sin(angle)])
  }
  return ring
}

function circleFeature(center: LatLng, radiusMetres: number): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circleRing(center, radiusMetres)] } }] }
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/* One polygon over the whole map: the warm wash the site multiplies over
   its tiles. */
const TINT: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } }],
}

/* One cottage on the map. Memoised on what it draws, so a pan that
   recomputes the clusters leaves untouched pins alone. */
type CottageMarkerProps = {
  cottage: Cottage
  found: boolean
  active: boolean
  justFound: boolean
  label: string
  onPress: (cottage: Cottage) => void
}

const CottageMarker = memo(function CottageMarker({ cottage, found, active, justFound, label, onPress }: CottageMarkerProps) {
  return (
    <Marker
      style={PIN_STYLE}
      id={cottage.slug}
      lngLat={[cottage.lng, cottage.lat]}
      anchor="bottom"
      onPress={() => onPress(cottage)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <CottagePin found={found} active={active} justFound={justFound} customImage={cottage.pin_custom_img} />
    </Marker>
  )
})

type ClusterMarkerProps = {
  id: number
  lng: number
  lat: number
  count: number
  label: string
  onPress: (id: number, lng: number, lat: number) => void
}

const ClusterMarker = memo(function ClusterMarker({ id, lng, lat, count, label, onPress }: ClusterMarkerProps) {
  return (
    <Marker id={`cluster-${id}`} style={PIN_STYLE} lngLat={[lng, lat]} anchor="center" onPress={() => onPress(id, lng, lat)} accessibilityRole="button" accessibilityLabel={label}>
      <ClusterBadge count={count} />
    </Marker>
  )
})

export const AtlasMap = memo(
  forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(
    { cottages, foundSlugs, selectedSlug, justFoundSlug, userPosition, bottomInset, onSelect, onMapPress, onLevelChange, onOutOfSight, reality },
    ref,
  ) {
    const { t } = useTranslation()
    const camera = useRef<CameraRef>(null)
    /* The seeker has moved the map themselves: the arrival stays away. */
    const touched = useRef(false)

    /* The device languages name the visitor's country (never geolocation),
       exactly as the browser languages do on the site. */
    const country = useMemo(() => homeCountry(cottages, detectCountry(getLocales().map((locale) => locale.languageTag))), [cottages])
    const homeBox = useMemo(() => homeBounds(cottages, country), [cottages, country])
    const home = useMemo(() => toLngLatBounds(homeBox), [homeBox])
    const initialView = useMemo<View>(() => {
      const [[south, west], [north, east]] = homeBox
      return { zoom: 6, bounds: [west, south, east, north], center: { lat: (south + north) / 2, lng: (west + east) / 2 } }
    }, [homeBox])
    /* The settled view (clusters, level) and the live one (isInView,
       recentre), the latter kept out of React state. */
    const [view, setView] = useState<View>(initialView)
    const liveView = useRef<View>(initialView)
    const krajMin = useMemo(() => krajMinFor(view), [view])

    const bySlug = useMemo(() => new Map(cottages.map((cottage) => [cottage.slug, cottage])), [cottages])
    const selected = selectedSlug ? bySlug.get(selectedSlug) ?? null : null

    const index = useMemo(() => {
      const clusters = new Supercluster<{ slug: string }>({ radius: CLUSTER_RADIUS, maxZoom: CLUSTERS_UNTIL_ZOOM })
      clusters.load(cottages.map((cottage) => ({ type: 'Feature', properties: { slug: cottage.slug }, geometry: { type: 'Point', coordinates: [cottage.lng, cottage.lat] } })))
      return clusters
    }, [cottages])

    const level: MapLevel = selected ? 'szlak' : levelForZoom(view.zoom, krajMin)
    useEffect(() => {
      onLevelChange(level)
    }, [level, onLevelChange])

    /* Clusters for what is on screen (plus a margin so pins slide in rather
       than pop), recomputed once the view has settled. */
    const clusters = useMemo(() => {
      const [west, south, east, north] = view.bounds
      const marginX = (east - west) * 0.2
      const marginY = (north - south) * 0.2
      return index.getClusters([west - marginX, south - marginY, east + marginX, north + marginY], Math.floor(view.zoom))
    }, [index, view])

    /* No cottage in the settled view: the nearest one, from the middle. */
    const outOfSight = useMemo<OutOfSight | null>(() => {
      const [west, south, east, north] = view.bounds
      if (cottages.some((cottage) => isWithinBounds(cottage, [[south, west], [north, east]]))) return null
      const nearest = nearestPlace(view.center, cottages)
      if (!nearest) return null
      return { cottage: nearest.place, distanceKm: nearest.distanceKm, heading: bearingDegrees(view.center, nearest.place) }
    }, [cottages, view])
    useEffect(() => {
      onOutOfSight(outOfSight)
    }, [outOfSight, onOutOfSight])

    const searchArea = useMemo(() => (selected ? circleFeature(selected, SEARCH_AREA_RADIUS_M) : EMPTY), [selected])
    const userAccuracy = useMemo(
      () => (userPosition?.accuracy ? circleFeature(userPosition, Math.max(userPosition.accuracy, MIN_ACCURACY_M)) : EMPTY),
      [userPosition],
    )

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          touched.current = true
          camera.current?.fitBounds(home, { padding: FRAME_PADDING, duration: FIT_MS })
        },
        showPosition: (position) => camera.current?.easeTo({ center: [position.lng, position.lat], zoom: toMapZoom(POSITION_ZOOM), duration: FIT_MS }),
        arriveAt: (seeker, nearest) => {
          if (touched.current) return
          camera.current?.fitBounds(toLngLatBounds(boundsAround(seeker, nearest ? [nearest] : [], ARRIVAL_RADIUS_KM)), { padding: FRAME_PADDING, duration: FIT_MS })
        },
        frameCottage: (cottage, bottomPadding, mode = 'ease') => {
          touched.current = true
          const stop = { center: [cottage.lng, cottage.lat] as [number, number], zoom: toMapZoom(COTTAGE_ZOOM), padding: { ...COTTAGE_PADDING, bottom: bottomPadding } }
          if (mode === 'fly') camera.current?.flyTo({ ...stop, duration: FLY_MS })
          else camera.current?.easeTo({ ...stop, duration: EASE_MS })
        },
        setBottomPadding: (px) => void camera.current?.setStop({ padding: { ...COTTAGE_PADDING, bottom: px }, duration: PADDING_MS }),
        recentre: () => {
          const { center } = liveView.current
          camera.current?.easeTo({ center: [center.lng, center.lat], padding: NO_PADDING, duration: RECENTRE_MS })
        },
        isInView: ({ lat, lng }) => {
          const [west, south, east, north] = liveView.current.bounds
          return lng >= west && lng <= east && lat >= south && lat <= north
        },
      }),
      [home],
    )

    /* The live handlers write the shared value and the live view only; the
       React view (clusters, level) follows once the map has been still for
       a moment. */
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(
      () => () => {
        if (settleTimer.current) clearTimeout(settleTimer.current)
      },
      [],
    )

    const onRegionIsChanging = useCallback(
      (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
        if (event.nativeEvent.userInteraction) touched.current = true
        const next = toView(event.nativeEvent)
        liveView.current = next
        reality.value = realityForZoom(next.zoom)
      },
      [reality],
    )

    const onRegionDidChange = useCallback(
      (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
        if (event.nativeEvent.userInteraction) touched.current = true
        const next = toView(event.nativeEvent)
        liveView.current = next
        reality.value = realityForZoom(next.zoom)
        if (settleTimer.current) clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => {
          settleTimer.current = null
          setView(next)
        }, VIEW_DEBOUNCE_MS)
      },
      [reality],
    )

    /* Marker presses are recorded so the map press that follows the same
       finger (the platforms differ in order) does not close the sheet. */
    const lastMarkerPress = useRef(0)
    const onSelectRef = useRef(onSelect)
    const onMapPressRef = useRef(onMapPress)
    useEffect(() => {
      onSelectRef.current = onSelect
      onMapPressRef.current = onMapPress
    })

    const onCottagePress = useCallback((cottage: Cottage) => {
      lastMarkerPress.current = Date.now()
      onSelectRef.current(cottage)
    }, [])

    const onClusterPress = useCallback(
      (id: number, lng: number, lat: number) => {
        lastMarkerPress.current = Date.now()
        touched.current = true
        haptic('select')
        camera.current?.easeTo({ center: [lng, lat], zoom: toMapZoom(Math.min(index.getClusterExpansionZoom(id), CLUSTERS_UNTIL_ZOOM + 1)), duration: CLUSTER_MS })
      },
      [index],
    )

    const onPress = useCallback(() => {
      if (Date.now() - lastMarkerPress.current < MARKER_PRESS_GUARD_MS) return
      onMapPressRef.current()
    }, [])

    return (
      <MapView
        style={styles.map}
        mapStyle={MAP_STYLE}
        logo={false}
        attribution
        attributionPosition={{ bottom: bottomInset + space.lg, right: 12 }}
        touchPitch={false}
        touchRotate={false}
        onPress={onPress}
        onRegionIsChanging={onRegionIsChanging}
        onRegionDidChange={onRegionDidChange}
      >
        <Camera ref={camera} initialViewState={{ bounds: home, padding: FRAME_PADDING }} maxBounds={EUROPE} minZoom={toMapZoom(3)} maxZoom={toMapZoom(18)} />

        <GeoJSONSource id="tint" data={TINT}>
          <Layer id="tint" type="fill" paint={{ 'fill-color': mapPalette.parchmentTint, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], toMapZoom(REALITY_FROM), 0.16, toMapZoom(REALITY_TO), 0.06] }} />
        </GeoJSONSource>

        <GeoJSONSource id="search-area" data={searchArea}>
          <Layer id="search-area-fill" type="fill" paint={{ 'fill-color': mapPalette.searchArea, 'fill-opacity': 0.12 }} />
          <Layer id="search-area-line" type="line" paint={{ 'line-color': mapPalette.searchArea, 'line-width': 2, 'line-opacity': 0.95, 'line-dasharray': [3, 3] }} />
        </GeoJSONSource>

        <GeoJSONSource id="user-accuracy" data={userAccuracy}>
          <Layer id="user-accuracy-fill" type="fill" paint={{ 'fill-color': mapPalette.userAccuracy, 'fill-opacity': 0.12 }} />
          <Layer id="user-accuracy-line" type="line" paint={{ 'line-color': mapPalette.userAccuracy, 'line-width': 1, 'line-opacity': 0.6 }} />
        </GeoJSONSource>

        {/* The seeker's dot lies under the pins and the clusters, the targets
            of the game (see PIN_STYLE). */}
        {userPosition ? (
          <Marker id="you" lngLat={[userPosition.lng, userPosition.lat]} anchor="center" style={styles.seeker} accessibilityLabel={t('map.youAreHere')}>
            <UserDot />
          </Marker>
        ) : null}

        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates
          if ('cluster' in feature.properties && feature.properties.cluster) {
            const id = feature.properties.cluster_id
            const count = feature.properties.point_count
            return <ClusterMarker key={`cluster-${id}`} id={id} lng={lng} lat={lat} count={count} label={t('map.clusterCottages', { count })} onPress={onClusterPress} />
          }
          const cottage = bySlug.get((feature.properties as { slug: string }).slug)
          if (!cottage) return null
          return (
            <CottageMarker
              key={cottage.slug}
              cottage={cottage}
              found={foundSlugs.has(cottage.slug)}
              active={cottage.slug === selectedSlug}
              justFound={cottage.slug === justFoundSlug}
              label={t('map.openMarker', { title: cottage.title })}
              onPress={onCottagePress}
            />
          )
        })}

      </MapView>
    )
  }),
)

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  seeker: {
    zIndex: 0,
  },
})
