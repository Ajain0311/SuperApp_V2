import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import {
  mapboxService,
  MapPlaceSuggestion,
  SelectedMapPlace,
} from '../../services/mapboxService';

type Props = {
  label?: string;
  initialCoordinate?: { latitude: number; longitude: number };
  initialAddress?: string;
  proximity?: { latitude: number; longitude: number };
  height?: number;
  hideSearchInput?: boolean;
  onSelect: (place: SelectedMapPlace) => void;
};

const canUseNativeMap = Platform.OS === 'ios' || Platform.OS === 'android';

let MapboxMaps: typeof import('@rnmapbox/maps') | null = null;
if (canUseNativeMap) {
  try {
    // Native-only; Expo Go / web will fall back to search list.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    MapboxMaps = require('@rnmapbox/maps');
  } catch {
    MapboxMaps = null;
  }
}

export const LocationMapPicker: React.FC<Props> = ({
  label = 'Search location',
  initialCoordinate,
  initialAddress,
  proximity,
  height = 220,
  hideSearchInput = false,
  onSelect,
}) => {
  const [query, setQuery] = useState(initialAddress || '');
  const [suggestions, setSuggestions] = useState<MapPlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedMapPlace | null>(
    initialCoordinate
      ? {
          latitude: initialCoordinate.latitude,
          longitude: initialCoordinate.longitude,
          address: initialAddress || '',
        }
      : null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<any>(null);

  const tokenReady = mapboxService.isConfigured();
  const MapView = MapboxMaps?.MapView;
  const Camera = MapboxMaps?.Camera;
  const PointAnnotation = MapboxMaps?.PointAnnotation;

  useEffect(() => {
    if (MapboxMaps?.default?.setAccessToken && tokenReady) {
      MapboxMaps.default.setAccessToken(mapboxService.getAccessToken());
    }
  }, [tokenReady]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!tokenReady || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setError(null);
        try {
          const rows = await mapboxService.searchPlaces(query, proximity || selected || undefined);
          setSuggestions(rows);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Search failed');
          setSuggestions([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tokenReady, proximity?.latitude, proximity?.longitude]);

  const applyPlace = (place: SelectedMapPlace) => {
    setSelected(place);
    setQuery(place.address);
    setSuggestions([]);
    onSelect(place);
    if (cameraRef.current?.setCamera) {
      cameraRef.current.setCamera({
        centerCoordinate: [place.longitude, place.latitude],
        zoomLevel: 14,
        animationDuration: 500,
      });
    }
  };

  const onSuggestionPress = (item: MapPlaceSuggestion) => {
    applyPlace({
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      city: item.city,
      state: item.state,
      pinCode: item.pinCode,
    });
  };

  const onMapPress = async (event: any) => {
    const coords = event?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    try {
      const place = await mapboxService.reverseGeocode(latitude, longitude);
      applyPlace(place);
    } catch {
      applyPlace({
        latitude,
        longitude,
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      });
    }
  };

  const center = useMemo(() => {
    const lat = selected?.latitude ?? initialCoordinate?.latitude ?? 28.6304;
    const lng = selected?.longitude ?? initialCoordinate?.longitude ?? 77.2177;
    return { latitude: lat, longitude: lng };
  }, [selected, initialCoordinate]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {!tokenReady ? (
        <Text style={styles.helper}>
          Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to .env, then rebuild with Expo Dev Client.
        </Text>
      ) : null}

      {!hideSearchInput && (
        <>
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search area, landmark, address..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {suggestions.length > 0 ? (
            <View style={styles.suggestionBox}>
              <FlatList
                keyboardShouldPersistTaps="handled"
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.suggestionRow} onPress={() => onSuggestionPress(item)}>
                    <MaterialIcons name="place" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.suggestionSub} numberOfLines={2}>
                        {item.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : null}
        </>
      )}

      {canUseNativeMap && MapView && Camera && PointAnnotation && tokenReady ? (
        <View style={[styles.mapBox, { height }]}>
          <MapView style={StyleSheet.absoluteFill} styleURL="mapbox://styles/mapbox/streets-v12" onPress={onMapPress}>
            <Camera
              ref={cameraRef}
              zoomLevel={13}
              centerCoordinate={[center.longitude, center.latitude]}
              animationMode="flyTo"
              animationDuration={0}
            />
            {selected ? (
              <PointAnnotation
                id="selected-pin"
                coordinate={[selected.longitude, selected.latitude]}
                title="Selected"
              >
                <View style={styles.pin}>
                  <MaterialIcons name="location-on" size={28} color={colors.error} />
                </View>
              </PointAnnotation>
            ) : null}
          </MapView>
          <Text style={styles.mapHint}>Tap map to drop pin · or search above</Text>
        </View>
      ) : (
        <View style={[styles.webFallback, { minHeight: 72 }]}>
          <MaterialIcons name="map" size={20} color={colors.textSecondary} />
          <Text style={styles.webFallbackText}>
            {selected
              ? `${selected.address}\n${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`
              : canUseNativeMap
                ? 'Map preview needs a Dev Client build with Mapbox token.'
                : 'Web: use search suggestions to pick a location (native map on Android/iOS Dev Client).'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  helper: { color: colors.textTertiary, fontSize: 12, marginBottom: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 11,
  },
  error: { color: colors.error, fontSize: 12, marginBottom: 6 },
  suggestionBox: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  suggestionTitle: { color: colors.textPrimary, fontWeight: '700' },
  suggestionSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  mapBox: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  mapHint: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  pin: { alignItems: 'center', justifyContent: 'center' },
  webFallback: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  webFallbackText: { color: colors.textSecondary, flex: 1, fontSize: 12, lineHeight: 18 },
});
