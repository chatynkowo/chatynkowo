import { useEffect, useMemo, useRef } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { getLocales } from 'expo-localization'
import { Camera, Layer, Map, Marker, RasterSource, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native'
import { detectCountry, EUROPE_BOUNDS, homeBounds, homeCountry, type BoundsTuple, type Cottage } from '@chatynkowo/core'
import { contentUrl } from '../../lib/content'
import { CottageIcon, FoundIcon, colors, iconSize } from '../../ui'

/* The expedition map: OpenStreetMap raster tiles (parity with the site's
   Leaflet map), one marker per cottage, the same per-country opening frame
   as the site (core/geo), and a tap on a marker that hands the cottage to
   the screen. */

type AtlasMapProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  selectedSlug: string | null
  onSelect: (cottage: Cottage) => void
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/* An empty style: the raster source and layer below are the whole map. */
const EMPTY_STYLE = { version: 8 as const, sources: {}, layers: [] }

/* core's [[south, west], [north, east]] -> MapLibre's [west, south, east, north]. */
function toLngLatBounds([[south, west], [north, east]]: BoundsTuple): LngLatBounds {
  return [west, south, east, north]
}

const EUROPE = toLngLatBounds(EUROPE_BOUNDS)
const FRAME_PADDING = { top: 48, right: 48, bottom: 48, left: 48 }

export function AtlasMap({ cottages, foundSlugs, selectedSlug, onSelect }: AtlasMapProps) {
  const { t } = useTranslation()
  const camera = useRef<CameraRef>(null)

  /* The device languages name the visitor's country (never geolocation),
     exactly as the browser languages do on the site. */
  const home = useMemo(() => {
    const country = homeCountry(cottages, detectCountry(getLocales().map((locale) => locale.languageTag)))
    return toLngLatBounds(homeBounds(cottages, country))
  }, [cottages])

  useEffect(() => {
    const selected = selectedSlug ? cottages.find((cottage) => cottage.slug === selectedSlug) : null
    if (selected) camera.current?.easeTo({ center: [selected.lng, selected.lat], zoom: 14, duration: 600 })
  }, [selectedSlug, cottages])

  return (
    <Map style={styles.map} mapStyle={EMPTY_STYLE} logo={false} attribution compassHiddenFacingNorth touchPitch={false}>
      <Camera ref={camera} initialViewState={{ bounds: home, padding: FRAME_PADDING }} maxBounds={EUROPE} minZoom={3} maxZoom={18} />
      <RasterSource id="osm" tiles={[OSM_TILES]} tileSize={256} maxzoom={19} attribution="OpenStreetMap contributors">
        <Layer id="osm-tiles" type="raster" />
      </RasterSource>
      {cottages.map((cottage) => (
        <Marker
          key={cottage.slug}
          id={cottage.slug}
          lngLat={[cottage.lng, cottage.lat]}
          anchor="bottom"
          onPress={() => onSelect(cottage)}
          accessibilityRole="button"
          accessibilityLabel={t('map.openMarker', { title: cottage.title })}
        >
          <MarkerPin found={foundSlugs.has(cottage.slug)} active={cottage.slug === selectedSlug} customImage={cottage.pin_custom_img} />
        </Marker>
      ))}
    </Map>
  )
}

function MarkerPin({ found, active, customImage }: { found: boolean; active: boolean; customImage?: string }) {
  return (
    <View style={[styles.pin, found && styles.pinFound, active && styles.pinActive]}>
      {customImage ? (
        <Image source={{ uri: contentUrl(customImage) }} style={styles.pinImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : found ? (
        <FoundIcon size={iconSize.md} weight="fill" color={colors.accentInk} />
      ) : (
        <CottageIcon size={iconSize.md} weight="fill" color={colors.ink} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  pin: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  pinFound: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  pinActive: {
    transform: [{ scale: 1.2 }],
    borderColor: colors.accentStrong,
  },
  pinImage: {
    width: 26,
    height: 26,
  },
})
