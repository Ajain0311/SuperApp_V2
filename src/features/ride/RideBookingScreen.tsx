import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { locationService } from '../../services/locationService';
import { LocationMapPicker } from '../../components/maps/LocationMapPicker';
import { mapboxService, SelectedMapPlace } from '../../services/mapboxService';

interface VehicleOption {
  type: string;
  name: string;
  tag: string;
  tagColor: string;
  subtitle: string;
  fare: number;
  icon: keyof typeof MaterialIcons.glyphMap;
  baseFare?: number;
  distanceFare?: number;
  timeFare?: number;
  bookingFee?: number;
  platformFee?: number;
  optionsTotal?: number;
}

const VEHICLES: VehicleOption[] = [
  {
    type: 'BIKE',
    name: 'Bike Taxi',
    tag: 'FASTEST',
    tagColor: colors.secondary,
    subtitle: 'Beat traffic • Helmet provided • 3m away',
    fare: 45.0,
    icon: 'two-wheeler',
  },
  {
    type: 'AUTO',
    name: 'Auto Rickshaw',
    tag: 'VALUE',
    tagColor: colors.blue,
    subtitle: 'Direct drop • Max 3 seats • 5m away',
    fare: 65.0,
    icon: 'electric-rickshaw',
  },
  {
    type: 'CAB',
    name: 'Economy Cab',
    tag: 'COMFORT',
    tagColor: colors.purple,
    subtitle: 'AC Hatchback • Luggage space • 7m away',
    fare: 125.0,
    icon: 'directions-car',
  },
];

export const RideBookingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [vehicles, setVehicles] = useState<VehicleOption[]>(VEHICLES);
  const [routeMetrics, setRouteMetrics] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Real Customer Device GPS State - initialized empty without hardcoded dummy locations
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState('Locating your position...');
  const [dropoffCoords, setDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState('Tap map to set destination');
  const [activePoint, setActivePoint] = useState<'pickup' | 'dropoff'>('dropoff');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'ONLINE' | 'LOCATING' | 'DENIED' | 'UNAVAILABLE'>('LOCATING');
  const [optionCatalog, setOptionCatalog] = useState<{ code: string; name: string; additionalAmount: number }[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeHits, setPlaceHits] = useState<{ label: string; latitude: number; longitude: number }[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [modalPoint, setModalPoint] = useState<'pickup' | 'dropoff'>('pickup');
  const [pickupInput, setPickupInput] = useState('');
  const [dropoffInput, setDropoffInput] = useState('');
  const [activeInput, setActiveInput] = useState<'pickup' | 'dropoff' | null>(null);

  const fetchEstimate = (
    pickup: { latitude: number; longitude: number } | null,
    pickupLabel: string,
    dropoff: { latitude: number; longitude: number } | null,
    dropoffLabel: string
  ) => {
    if (!pickup || !dropoff) {
      setRouteMetrics(null);
      return;
    }

    apiClient
      .post<any>(ApiEndpoints.ride.estimate, {
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        pickupAddress: pickupLabel,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
        dropoffAddress: dropoffLabel,
        optionCodes: selectedOptions,
      })
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) {
          if (data.distanceKm && data.estimatedMinutes) {
            setRouteMetrics(
              `${data.distanceKm} km • ~${data.estimatedMinutes} mins • ${data.trafficCondition || 'Moderate Traffic'}`
            );
          }
          if (data.vehicleOptions && data.vehicleOptions.length > 0) {
            const mapped: VehicleOption[] = data.vehicleOptions.map((v: any) => ({
              type: v.vehicleType || 'BIKE',
              name: v.title || v.vehicleType,
              tag: v.tag || 'FASTEST',
              tagColor:
                v.vehicleType === 'CAB'
                  ? colors.purple
                  : v.vehicleType === 'AUTO'
                  ? colors.blue
                  : colors.secondary,
              subtitle: v.subtitle || 'Nearby driver',
              fare: Number(v.estimatedFare) || 50,
              baseFare: Number(v.baseFare) || 0,
              distanceFare: Number(v.distanceFare) || 0,
              timeFare: Number(v.timeFare) || 0,
              bookingFee: Number(v.bookingFee) || 0,
              platformFee: Number(v.platformFee) || 0,
              optionsTotal: Number(v.optionsTotal) || 0,
              icon:
                v.vehicleType === 'CAB'
                  ? 'directions-car'
                  : v.vehicleType === 'AUTO'
                  ? 'electric-rickshaw'
                  : 'two-wheeler',
            }));
            setVehicles(mapped);
          }
          if (Array.isArray(data.availableOptions)) {
            setOptionCatalog(data.availableOptions.map((o: any) => ({
              code: o.code,
              name: o.name,
              additionalAmount: Number(o.additionalAmount) || 0,
            })));
          }
        }
      })
      .catch(() => {
        setRouteMetrics('Fare could not be calculated. Check the connection and try again.');
      });
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    setGpsStatus('LOCATING');
    try {
      const loc = await locationService.getCurrentLocation({ timeoutMs: 8000 });
      const newCoords = { latitude: loc.latitude, longitude: loc.longitude };
      const newAddress = loc.formattedAddress || `${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}°`;
      setPickupCoords(newCoords);
      setPickupAddress(newAddress);
      setGpsStatus('ONLINE');
      if (dropoffCoords) {
        fetchEstimate(newCoords, newAddress, dropoffCoords, dropoffAddress);
      }
    } catch (error) {
      console.warn('[RideBookingScreen] Could not retrieve GPS:', error);
      const message = String((error as any)?.message || '');
      setGpsStatus(message.toLowerCase().includes('denied') ? 'DENIED' : 'UNAVAILABLE');
      setPickupAddress(message.toLowerCase().includes('denied')
        ? 'Location permission denied. Search or move the map pin.'
        : 'GPS unavailable. Search an address or move the map pin.');
    } finally {
      setIsLocating(false);
    }
  };

  const openMapModal = (point: 'pickup' | 'dropoff') => {
    setModalPoint(point);
    setActivePoint(point);
    setIsMapModalVisible(true);
  };

  const handlePlaceSelect = (place: SelectedMapPlace) => {
    const coords = { latitude: place.latitude, longitude: place.longitude };
    if (activePoint === 'pickup') {
      setPickupCoords(coords);
      setPickupAddress(place.address || `${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`);
      setPickupInput(place.address || '');
      if (dropoffCoords) {
        fetchEstimate(coords, place.address, dropoffCoords, dropoffAddress);
      }
      return;
    }
    setDropoffCoords(coords);
    setDropoffAddress(place.address || `${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`);
    setDropoffInput(place.address || '');
    if (pickupCoords) {
      fetchEstimate(pickupCoords, pickupAddress, coords, place.address);
    }
  };

  useEffect(() => {
    handleLocateMe();
  }, []);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      fetchEstimate(pickupCoords, pickupAddress, dropoffCoords, dropoffAddress);
    }
  }, [selectedOptions.join('|')]);

  const searchPlaces = async (text: string, point: 'pickup' | 'dropoff') => {
    setActiveInput(point);
    if (point === 'pickup') {
      setPickupInput(text);
    } else {
      setDropoffInput(text);
    }
    setSearchError(null);
    if (text.trim().length < 2) {
      setPlaceHits([]);
      return;
    }
    try {
      const hits = await mapboxService.searchPlaces(text.trim(), pickupCoords || undefined);
      setPlaceHits(hits.map((hit) => ({ label: hit.address || hit.name, latitude: hit.latitude, longitude: hit.longitude })));
    } catch {
      setSearchError('Address search failed. Use map pin or try again.');
      setPlaceHits([]);
    }
  };

  const chooseSearchHit = async (hit: { label: string; latitude: number; longitude: number }) => {
    let address = hit.label;
    try {
      const reversed = await mapboxService.reverseGeocode(hit.latitude, hit.longitude);
      if (reversed.address) address = reversed.address;
    } catch {
      // Fallback to hit.label
    }
    const currentPoint = activeInput || activePoint;
    setActivePoint(currentPoint);
    handlePlaceSelect({ latitude: hit.latitude, longitude: hit.longitude, address });
    setPlaceHits([]);
    setActiveInput(null);
  };

  const selectedVehicle = vehicles[selectedIndex] || vehicles[0];

  const handleBookRide = async () => {
    if (!pickupCoords) {
      Alert.alert('Pickup Required', 'Please set your pickup location on the map.');
      return;
    }
    if (!dropoffCoords) {
      Alert.alert('Destination Required', 'Please tap on the map to set your destination.');
      return;
    }

    setIsBooking(true);
    try {
      const res = await apiClient.post<any>(ApiEndpoints.ride.book, {
        vehicleType: selectedVehicle.type,
        pickupAddress,
        pickupLatitude: pickupCoords.latitude,
        pickupLongitude: pickupCoords.longitude,
        dropoffAddress,
        dropoffLatitude: dropoffCoords.latitude,
        dropoffLongitude: dropoffCoords.longitude,
        paymentMethod: 'CASH',
        optionCodes: selectedOptions,
      });
      const data = res.data?.data || res.data;
      const rideId = data?.rideNumber || `RD-${data?.id || 'NEW'}`;
      const rideNumericId = data?.id;
      navigation.navigate('ActiveRide', {
        rideId,
        rideNumericId,
        rideData: data,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to book ride. Please check connection and try again.';
      Alert.alert('Booking Error', msg);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Prefer sibling tab jump; avoid nested MainTabs navigate which can remount web stack.
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('MainTabs', { screen: 'Home' });
          }}
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Your Ride</Text>
        <TouchableOpacity
          style={[
            styles.gpsChip,
            gpsStatus === 'DENIED' && styles.gpsChipDenied,
            gpsStatus === 'LOCATING' && styles.gpsChipLocating,
          ]}
          onPress={handleLocateMe}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={gpsStatus === 'DENIED' ? 'location-off' : isLocating ? 'sync' : 'gps-fixed'}
            size={13}
            color={gpsStatus === 'DENIED' ? colors.error : isLocating ? colors.blue : colors.secondary}
          />
          <Text
            style={[
              styles.gpsText,
              gpsStatus === 'DENIED' && { color: colors.error },
              gpsStatus === 'LOCATING' && { color: colors.blue },
            ]}
          >
            {isLocating ? 'Locating...' : gpsStatus === 'DENIED' ? 'GPS Denied' : 'GPS Online'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Rapido-Style Location Inputs Card */}
        <View style={styles.card}>
          {/* Pickup Row */}
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <View style={styles.inputWrapper}>
              <View style={styles.pickupHeaderRow}>
                <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
                <TouchableOpacity
                  onPress={handleLocateMe}
                  disabled={isLocating}
                  style={styles.locateMeButton}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="my-location" size={12} color={colors.primary} />
                  <Text style={styles.locateMeText}>{isLocating ? 'Locating...' : 'Use GPS'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={activeInput === 'pickup' ? pickupInput : (pickupAddress || '')}
                onChangeText={(t) => searchPlaces(t, 'pickup')}
                onFocus={() => {
                  setActiveInput('pickup');
                  setActivePoint('pickup');
                  setPickupInput(pickupAddress.startsWith('Locating') ? '' : pickupAddress);
                }}
                placeholder="Where to pick you up?"
                placeholderTextColor={colors.textSecondary}
                style={styles.textInput}
              />
            </View>
            <TouchableOpacity
              style={styles.pinMapBtn}
              onPress={() => openMapModal('pickup')}
              accessibilityLabel="Pin pickup on map"
            >
              <MaterialIcons name="map" size={20} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLineVertical} />
            <View style={styles.dividerHorizontal} />
          </View>

          {/* Destination Row */}
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: colors.error }]} />
            <View style={styles.inputWrapper}>
              <Text style={styles.locationLabel}>WHERE TO?</Text>
              <TextInput
                value={activeInput === 'dropoff' ? dropoffInput : (dropoffAddress.startsWith('Tap map') ? '' : dropoffAddress)}
                onChangeText={(t) => searchPlaces(t, 'dropoff')}
                onFocus={() => {
                  setActiveInput('dropoff');
                  setActivePoint('dropoff');
                  setDropoffInput(dropoffAddress.startsWith('Tap map') ? '' : dropoffAddress);
                }}
                placeholder="Enter drop destination"
                placeholderTextColor={colors.textSecondary}
                style={styles.textInput}
              />
            </View>
            <TouchableOpacity
              style={styles.pinMapBtn}
              onPress={() => openMapModal('dropoff')}
              accessibilityLabel="Pin destination on map"
            >
              <MaterialIcons name="map" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          {/* Autocomplete Dropdown List */}
          {placeHits.length > 0 && (
            <View style={styles.autocompleteContainer}>
              {placeHits.map((hit, idx) => (
                <TouchableOpacity
                  key={`${hit.latitude}-${hit.longitude}-${idx}`}
                  onPress={() => chooseSearchHit(hit)}
                  style={styles.autocompleteItem}
                >
                  <MaterialIcons name="place" size={18} color={colors.primary} />
                  <Text style={styles.autocompleteText} numberOfLines={2}>
                    {hit.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {searchError ? (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{searchError}</Text>
          ) : null}
        </View>

        {/* Route Metrics / Guidance Badge */}
        {routeMetrics ? (
          <View style={styles.metricsBadge}>
            <MaterialIcons name="alt-route" size={16} color={colors.blue} />
            <Text style={styles.metricsText}>{routeMetrics}</Text>
          </View>
        ) : (
          <View style={[styles.metricsBadge, { backgroundColor: 'rgba(255, 107, 0, 0.08)' }]}>
            <MaterialIcons name="touch-app" size={16} color={colors.primary} />
            <Text style={[styles.metricsText, { color: colors.textSecondary }]}>
              {dropoffCoords
                ? 'Calculating route & fares...'
                : 'Type drop location or tap 🗺️ map icon to set on map'}
            </Text>
          </View>
        )}

        {/* Available Vehicles Section Header */}
        {optionCatalog.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeader}>RIDE OPTIONS</Text>
            {optionCatalog.map((option) => {
              const on = selectedOptions.includes(option.code);
              return (
                <TouchableOpacity
                  key={option.code}
                  onPress={() => setSelectedOptions((current) => on ? current.filter((code) => code !== option.code) : [...current, option.code])}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.textPrimary }}>
                    {on ? '✓' : '○'} {option.name}  +₹{option.additionalAmount}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {selectedVehicle.baseFare ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.textSecondary }}>Estimated fare · {routeMetrics || 'set pickup and destination'}</Text>
            <Text style={{ color: colors.textPrimary }}>Base ₹{selectedVehicle.baseFare} · Distance ₹{selectedVehicle.distanceFare} · Time ₹{selectedVehicle.timeFare}</Text>
            <Text style={{ color: colors.textPrimary }}>Booking ₹{selectedVehicle.bookingFee} · Platform ₹{selectedVehicle.platformFee} · Options ₹{selectedVehicle.optionsTotal || 0}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionHeader}>AVAILABLE VEHICLES</Text>

        {/* Vehicles List */}
        {vehicles.map((vehicle, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={vehicle.type}
              activeOpacity={0.8}
              style={[
                styles.vehicleCard,
                isSelected && styles.vehicleCardSelected,
              ]}
              onPress={() => setSelectedIndex(index)}
            >
              <View
                style={[
                  styles.vehicleIconContainer,
                  { backgroundColor: `${vehicle.tagColor}26` },
                ]}
              >
                <MaterialIcons name={vehicle.icon as any} size={24} color={vehicle.tagColor} />
              </View>

              <View style={styles.vehicleInfo}>
                <View style={styles.vehicleTitleRow}>
                  <Text
                    style={[
                      styles.vehicleName,
                      isSelected && { fontWeight: '800' },
                    ]}
                  >
                    {vehicle.name}
                  </Text>
                  <View
                    style={[
                      styles.tagBadge,
                      { backgroundColor: `${vehicle.tagColor}33` },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: vehicle.tagColor }]}>
                      {vehicle.tag}
                    </Text>
                  </View>
                </View>
                <Text style={styles.vehicleSubtitle}>{vehicle.subtitle}</Text>
              </View>

              <Text
                style={[
                  styles.vehicleFare,
                  isSelected && { color: colors.primary },
                ]}
              >
                ₹{vehicle.fare.toFixed(0)}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Bottom Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.paymentButton}>
            <MaterialIcons name="payment" size={18} color={colors.textSecondary} />
            <Text style={styles.paymentText}>Cash / UPI ▼</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.bookButton,
              (isBooking || !dropoffCoords) && { opacity: 0.6 },
            ]}
            disabled={isBooking || !dropoffCoords}
            onPress={handleBookRide}
            testID="book-ride-button"
            accessibilityLabel="Book Ride"
          >
            <Text style={styles.bookButtonText}>
              {isBooking
                ? 'Booking Ride...'
                : !dropoffCoords
                ? 'Select Destination to Book'
                : `Confirm ride · estimated ₹${selectedVehicle.fare.toFixed(0)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pin on Map Modal */}
      {isMapModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Pin {modalPoint === 'pickup' ? 'Pickup' : 'Destination'} on Map
              </Text>
              <TouchableOpacity
                onPress={() => setIsMapModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalMapContent}>
              <LocationMapPicker
                key={modalPoint}
                label={modalPoint === 'pickup' ? 'Drag or tap map to set pickup' : 'Drag or tap map to set destination'}
                initialCoordinate={modalPoint === 'pickup' ? pickupCoords || undefined : dropoffCoords || undefined}
                initialAddress={modalPoint === 'pickup' ? pickupAddress : dropoffAddress}
                proximity={pickupCoords || undefined}
                height={300}
                hideSearchInput={false}
                onSelect={(place) => {
                  handlePlaceSelect(place);
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setIsMapModalVisible(false)}
            >
              <Text style={styles.modalDoneBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.3)',
    gap: 4,
  },
  gpsChipDenied: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  gpsChipLocating: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  gpsText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  locationTextGroup: {
    flex: 1,
  },
  pickupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locateMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  locateMeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  locationValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  coordsSubtitle: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLineVertical: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 4,
    marginRight: spacing.md,
  },
  dividerHorizontal: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: spacing.sm,
    gap: 6,
  },
  metricsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    marginTop: 2,
  },
  pinMapBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autocompleteContainer: {
    marginTop: 10,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxHeight: 180,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  autocompleteText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalMapContent: {
    marginVertical: 4,
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1.0,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  vehicleCardSelected: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  vehicleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  vehicleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  vehicleFare: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: 12,
  },
  paymentButton: {
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bookButton: {
    flex: 1,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    ...typography.bodyLarge,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
