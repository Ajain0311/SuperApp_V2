import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  TextInput,
  AppState,
  AppStateStatus,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormKeyboardAvoid } from '../../components/common/FormKeyboardAvoid';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { driverService, DriverProfile, DriverRideItem } from '../../services/driverService';
import { signalRService } from '../../services/signalr';
import { locationService } from '../../services/locationService';
import { mapboxService } from '../../services/mapboxService';
import { useRoleStore } from '../../store/roleStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const canUseNativeMap = Platform.OS === 'ios' || Platform.OS === 'android';
let MapboxMaps: typeof import('@rnmapbox/maps') | null = null;
if (canUseNativeMap) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    MapboxMaps = require('@rnmapbox/maps');
  } catch {
    MapboxMaps = null;
  }
}
import { spacing } from '../../theme/spacing';
import { MainTabParamList } from '../../navigation/types';
import { shadowStyle } from '../../utils/platformStyles';
import {
  getRideMapPhase,
  shouldRevealDestination,
  resolveRouteEndpoints,
  shouldRecalculateRoute,
  isValidLatLng,
  isTerminalRideStatus,
  buildLineGeoJson,
  collectMapPoints,
  boundsFromPoints,
  type RouteRecalcSnapshot,
} from '../ride/rideMapUtils';

export const DriverHomeScreen: React.FC = () => {

  const route = useRoute<RouteProp<MainTabParamList, 'DriverHome'>>();
  const { activeRole } = useRoleStore();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [availableRides, setAvailableRides] = useState<DriverRideItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [startOtpInput, setStartOtpInput] = useState('');
  const [isStartingRide, setIsStartingRide] = useState(false);
  const [captainCoords, setCaptainCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [followCamera, setFollowCamera] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const locationWatcherRef = useRef<(() => void) | null>(null);
  const alertedRideIdsRef = useRef<Set<number>>(new Set());
  const cameraRef = useRef<any>(null);
  const lastRouteFetchRef = useRef<RouteRecalcSnapshot | null>(null);
  const subscribedRideIdRef = useRef<number | null>(null);

  const tokenReady = mapboxService.isConfigured();
  const MapView = MapboxMaps?.MapView;
  const Camera = MapboxMaps?.Camera;
  const PointAnnotation = MapboxMaps?.PointAnnotation;
  const ShapeSource = MapboxMaps?.ShapeSource;
  const LineLayer = MapboxMaps?.LineLayer;

  useEffect(() => {
    if (MapboxMaps?.default?.setAccessToken && tokenReady) {
      MapboxMaps.default.setAccessToken(mapboxService.getAccessToken());
    }
  }, [tokenReady]);

  const loadDriverData = useCallback(async () => {
    try {
      const p = await driverService.getProfile();
      if (p.currentLatitude && p.currentLongitude) {
        setCaptainCoords({ latitude: p.currentLatitude, longitude: p.currentLongitude });
      }
      setProfile(p);
      setIsOnline(p.isOnline);

      // Rides only — food delivery is handled by the hotel, not captains.
      const [active, available] = await Promise.all([
        driverService.getActiveRide().catch((err) => {
          console.warn('[DriverHome] active ride fetch failed:', err?.message || err);
          return null;
        }),
        p.isOnline
          ? driverService.getAvailableRides().catch((err) => {
              console.warn('[DriverHome] available rides fetch failed:', err?.message || err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      setActiveRide(active);
      setAvailableRides(available);
    } catch (e: any) {
      console.warn('[DriverHome] Error loading driver data:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Keep ride offers fresh while online (SignalR can miss events after role switch).
  useEffect(() => {
    if (!isOnline) return;
    const timer = setInterval(() => {
      loadDriverData();
    }, 8000);
    return () => clearInterval(timer);
  }, [isOnline, loadDriverData]);

  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState<[number, number][] | null>(null);
  const [roadRouteMeta, setRoadRouteMeta] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

  const mapPhase = useMemo(() => getRideMapPhase(activeRide?.status), [activeRide?.status]);
  const isTripStarted = mapPhase === 'to_destination';
  const revealDestination = shouldRevealDestination(mapPhase);
  const rideIsTerminal = mapPhase === 'terminal' || isTerminalRideStatus(activeRide?.status);

  const pickupCoords = useMemo(() => {
    if (!activeRide) return null;
    return { latitude: Number(activeRide.pickupLatitude), longitude: Number(activeRide.pickupLongitude) };
  }, [activeRide?.pickupLatitude, activeRide?.pickupLongitude]);

  const dropoffCoords = useMemo(() => {
    if (!activeRide) return null;
    return { latitude: Number(activeRide.dropoffLatitude), longitude: Number(activeRide.dropoffLongitude) };
  }, [activeRide?.dropoffLatitude, activeRide?.dropoffLongitude]);

  const pickupCoordsValid = isValidLatLng(pickupCoords);
  const dropoffCoordsValid = isValidLatLng(dropoffCoords);
  const captainCoordsValid = isValidLatLng(captainCoords);

  const targetCoords = useMemo(() => {
    if (!activeRide) return null;
    if (isTripStarted && dropoffCoordsValid) {
      return {
        latitude: Number(activeRide.dropoffLatitude),
        longitude: Number(activeRide.dropoffLongitude),
        address: activeRide.dropoffAddress || 'Customer Destination',
        label: 'Destination',
      };
    }
    if (pickupCoordsValid) {
      return {
        latitude: Number(activeRide.pickupLatitude),
        longitude: Number(activeRide.pickupLongitude),
        address: activeRide.pickupAddress || 'Customer Pickup',
        label: 'Pickup',
      };
    }
    return null;
  }, [isTripStarted, dropoffCoordsValid, pickupCoordsValid, activeRide]);

  const routeEndpoints = useMemo(
    () =>
      resolveRouteEndpoints({
        phase: mapPhase,
        driver: captainCoordsValid ? captainCoords : null,
        pickup: pickupCoordsValid ? pickupCoords : null,
        dropoff: dropoffCoordsValid ? dropoffCoords : null,
      }),
    [mapPhase, captainCoords, captainCoordsValid, pickupCoords, pickupCoordsValid, dropoffCoords, dropoffCoordsValid]
  );

  // Throttled Mapbox Directions — Phase A captain→pickup, Phase B captain→destination.
  useEffect(() => {
    if (!activeRide || rideIsTerminal || !routeEndpoints) {
      setRoadRouteCoordinates(null);
      setRoadRouteMeta(null);
      setRouteLoading(false);
      lastRouteFetchRef.current = null;
      return;
    }

    if (!mapboxService.isConfigured()) {
      setRoadRouteCoordinates(null);
      setRoadRouteMeta(null);
      return;
    }

    const now = Date.now();
    if (!shouldRecalculateRoute(lastRouteFetchRef.current, routeEndpoints, now)) {
      return;
    }

    let isSubscribed = true;
    setRouteLoading(true);
    mapboxService
      .getDirectionsRoute(
        { latitude: routeEndpoints.origin.latitude, longitude: routeEndpoints.origin.longitude },
        { latitude: routeEndpoints.destination.latitude, longitude: routeEndpoints.destination.longitude }
      )
      .then((res) => {
        if (!isSubscribed) return;
        lastRouteFetchRef.current = { ...routeEndpoints, at: Date.now() };
        if (res && res.coordinates.length > 0) {
          setRoadRouteCoordinates(res.coordinates);
          setRoadRouteMeta({ distanceKm: res.distanceKm, durationMinutes: res.durationMinutes });
        } else {
          setRoadRouteCoordinates(null);
          setRoadRouteMeta(null);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setRoadRouteCoordinates(null);
          setRoadRouteMeta(null);
        }
      })
      .finally(() => {
        if (isSubscribed) setRouteLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [
    activeRide?.id,
    rideIsTerminal,
    routeEndpoints?.origin.latitude,
    routeEndpoints?.origin.longitude,
    routeEndpoints?.destination.latitude,
    routeEndpoints?.destination.longitude,
    mapPhase,
  ]);

  const navigationDistanceText = useMemo(() => {
    if (rideIsTerminal) return null;
    if (roadRouteMeta) {
      const dist = roadRouteMeta.distanceKm < 1 ? `${Math.round(roadRouteMeta.distanceKm * 1000)} m` : `${roadRouteMeta.distanceKm.toFixed(1)} km`;
      return `${dist} • ~${roadRouteMeta.durationMinutes} min`;
    }
    if (!routeEndpoints) return null;
    const distKm = locationService.calculateDistanceKm(
      routeEndpoints.origin.latitude,
      routeEndpoints.origin.longitude,
      routeEndpoints.destination.latitude,
      routeEndpoints.destination.longitude
    );
    if (!Number.isFinite(distKm)) return null;
    if (distKm < 1.0) {
      return `${Math.round(distKm * 1000)} m`;
    }
    return `${distKm.toFixed(1)} km`;
  }, [rideIsTerminal, roadRouteMeta, routeEndpoints]);

  const routeGeoJson = useMemo(
    () => buildLineGeoJson(roadRouteCoordinates, routeEndpoints),
    [roadRouteCoordinates, routeEndpoints]
  );

  const mapBounds = useMemo(() => {
    const pts = collectMapPoints({
      phase: mapPhase,
      driver: captainCoordsValid ? captainCoords : null,
      pickup: pickupCoordsValid ? pickupCoords : null,
      dropoff: dropoffCoordsValid ? dropoffCoords : null,
    });
    return boundsFromPoints(pts);
  }, [mapPhase, captainCoords, captainCoordsValid, pickupCoords, pickupCoordsValid, dropoffCoords, dropoffCoordsValid]);

  useEffect(() => {
    if (!followCamera || !cameraRef.current || !mapBounds) return;
    try {
      cameraRef.current.fitBounds(mapBounds.ne, mapBounds.sw, 56, 600);
    } catch {
      /* camera optional */
    }
  }, [followCamera, mapBounds?.ne[0], mapBounds?.ne[1], mapBounds?.sw[0], mapBounds?.sw[1], mapPhase]);

  const handleRecenterMap = () => {
    setFollowCamera(true);
    if (cameraRef.current && mapBounds) {
      try {
        cameraRef.current.fitBounds(mapBounds.ne, mapBounds.sw, 56, 500);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  // AppState listener: synchronize available rides on background-to-foreground resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadDriverData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadDriverData]);

  // Deep-link handling: if launched via push notification with a focusRideId
  useEffect(() => {
    const focusRideId = route.params?.focusRideId;
    if (!focusRideId) return;

    const checkAndPromptRide = async () => {
      try {
        // If driver was offline when opening push, bring them online so they can accept
        if (!isOnline) {
          try {
            await driverService.toggleOnline(true);
            setIsOnline(true);
          } catch {
            // Non-blocking if toggle fails
          }
        }

        const available = await driverService.getAvailableRides();
        setAvailableRides(available);
        const matched = available.find((r) => r.id === focusRideId);
        if (matched) {
          if (!alertedRideIdsRef.current.has(matched.id)) {
            alertedRideIdsRef.current.add(matched.id);
            Alert.alert(
              '🚖 Ride Request',
              `Ride #${matched.rideNumber}\nPickup: ${matched.pickupAddress}\nDrop: ${matched.dropoffAddress}\nFare: ₹${matched.fare}`,
              [
                { text: 'Ignore', style: 'cancel' },
                { text: 'Accept Trip', onPress: () => handleAcceptRide(matched.id) },
              ]
            );
          }
        } else {
          Alert.alert('Ride Notice', 'This ride is no longer available, has expired, or has already been accepted.');
        }
      } catch {
        Alert.alert('Ride Notice', 'This ride is no longer available.');
      }
    };

    checkAndPromptRide();
  }, [route.params?.focusRideId]);


  // Real-time SignalR driver pool and active ride tracking (rides only)
  useEffect(() => {
    let unregisterStatus: (() => void) | null = null;
    let unregisterRequested: (() => void) | null = null;
    let unregisterAcceptedByOther: (() => void) | null = null;
    let unregisterCancelled: (() => void) | null = null;
    let unregisterExpired: (() => void) | null = null;

    const setupSignalR = async () => {
      try {
        const hub = await signalRService.connectRideHub();
        if (hub) {
          // Join driver dispatch pool
          await hub.invoke('JoinDriversPool').catch(() => {});

          if (activeRide?.id) {
            subscribedRideIdRef.current = activeRide.id;
            await hub.invoke('JoinRide', activeRide.id).catch(() => {});
          }

          unregisterStatus = signalRService.onRideStatusChanged((event) => {
            if (activeRide && event.rideId === activeRide.id && subscribedRideIdRef.current === activeRide.id) {
              setActiveRide((prev: any) => prev ? { ...prev, status: event.status } : null);
              if (event.status === 'COMPLETED' || event.status === 'CANCELLED' || event.status === 'EXPIRED' || event.status === 'FAILED') {
                lastRouteFetchRef.current = null;
                setRoadRouteCoordinates(null);
                setRoadRouteMeta(null);
                loadDriverData();
              }
            }
          });

          // Real-time live incoming ride requests broadcast
          unregisterRequested = signalRService.onRideRequested((incoming: any) => {
            if (!incoming) return;
            // Mark incoming as alerted to deduplicate with incoming push notifications
            if (alertedRideIdsRef.current.has(incoming.id)) return;
            alertedRideIdsRef.current.add(incoming.id);

            setAvailableRides((prev) => {
              if (prev.some((r) => r.id === incoming.id)) return prev;
              const mapped: DriverRideItem = {
                id: incoming.id,
                rideNumber: incoming.rideNumber,
                pickupAddress: incoming.pickupAddress,
                dropoffAddress: incoming.dropoffAddress,
                fare: incoming.fare || incoming.estimatedFare || 0,
                estimatedFare: incoming.fare || incoming.estimatedFare,
                distanceKm: incoming.distanceKm || 5.0,
                vehicleType: incoming.vehicleType || 'BIKE',
                status: incoming.status || 'REQUESTED',
                customerName: incoming.customerName || 'Customer',
                customerPhone: incoming.customerPhone || '',
                pickupLatitude: incoming.pickupLatitude,
                pickupLongitude: incoming.pickupLongitude,
                dropoffLatitude: incoming.dropoffLatitude,
                dropoffLongitude: incoming.dropoffLongitude,
                createdAt: incoming.createdAt || new Date().toISOString(),
              };
              return [mapped, ...prev];
            });

            if (isOnline && !activeRide) {
              Alert.alert(
                '🔔 New Ride Request Available!',
                `Ride #${incoming.rideNumber}\nPickup: ${incoming.pickupAddress}\nEstimated Fare: ₹${incoming.fare || incoming.estimatedFare}`,
                [
                  { text: 'Ignore', style: 'cancel' },
                  { text: 'Accept Trip', onPress: () => handleAcceptRide(incoming.id) },
                ]
              );
            }
          });


          // Live sync when another driver accepts first
          unregisterAcceptedByOther = signalRService.onRideAcceptedByOther((data: any) => {
            if (data?.rideId) {
              alertedRideIdsRef.current.add(data.rideId);
              setAvailableRides((prev) => prev.filter((r) => r.id !== data.rideId));
            }
          });

          // Live sync when customer cancels ride
          unregisterCancelled = signalRService.onRideCancelled((data: any) => {
            if (data?.rideId) {
              alertedRideIdsRef.current.add(data.rideId);
              setAvailableRides((prev) => prev.filter((r) => r.id !== data.rideId));
              if (activeRide && activeRide.id === data.rideId) {
                setActiveRide(null);
                Alert.alert('Ride Cancelled', 'The customer has cancelled this ride request.');
                loadDriverData();
              }
            }
          });

          // Live sync when ride request expires (after 5 minutes)
          unregisterExpired = signalRService.onRideExpired((data: any) => {
            if (data?.rideId) {
              alertedRideIdsRef.current.add(data.rideId);
              setAvailableRides((prev) => prev.filter((r) => r.id !== data.rideId));
              if (activeRide && activeRide.id === data.rideId) {
                setActiveRide(null);
                loadDriverData();
              }
            }
          });
        }
      } catch (err) {
        console.warn('[DriverHome] SignalR setup warning:', err);
      }
    };

    setupSignalR();

    return () => {
      if (activeRide?.id && subscribedRideIdRef.current === activeRide.id) {
        signalRService.leaveRide(activeRide.id).catch(() => {});
        subscribedRideIdRef.current = null;
      }
      if (unregisterStatus) unregisterStatus();
      if (unregisterRequested) unregisterRequested();
      if (unregisterAcceptedByOther) unregisterAcceptedByOther();
      if (unregisterCancelled) unregisterCancelled();
      if (unregisterExpired) unregisterExpired();
    };
  }, [activeRide?.id, isOnline, loadDriverData]);

  // Foreground GPS tracking only when Online and has an active trip
  useEffect(() => {
    if (isOnline && activeRide && (activeRide.status === 'ACCEPTED' || activeRide.status === 'ARRIVING' || activeRide.status === 'STARTED')) {
      const startTracking = async () => {
        try {
          const unsub = await locationService.watchLocation(
            async (coords) => {
              try {
                if (!isValidLatLng({ latitude: coords.latitude, longitude: coords.longitude })) {
                  return;
                }

                setCaptainCoords({ latitude: coords.latitude, longitude: coords.longitude });

                await driverService.updateLocation(
                  coords.latitude,
                  coords.longitude,
                  activeRide.id,
                  coords.heading ?? undefined,
                  coords.speed ?? undefined
                );
              } catch {
                // Ignore transient telemetry drops
              }
            },
            { distanceInterval: 10, timeInterval: 5000 }
          );
          locationWatcherRef.current = unsub;
        } catch {
          // Location permission not granted or GPS unavailable
        }
      };

      startTracking();
    } else {
      if (locationWatcherRef.current) {
        locationWatcherRef.current();
        locationWatcherRef.current = null;
      }
    }

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current();
        locationWatcherRef.current = null;
      }
    };
  }, [isOnline, activeRide?.id, activeRide?.status]);

  const handleToggleOnline = async (val: boolean) => {
    setIsTogglingDuty(true);
    try {
      const updatedStatus = await driverService.toggleOnline(val);
      setIsOnline(updatedStatus);
      if (updatedStatus) {
        const available = await driverService.getAvailableRides();
        setAvailableRides(available);
      } else {
        setAvailableRides([]);
      }
    } catch (e: any) {
      Alert.alert('Duty Toggle Failed', e.message || 'Could not update online status');
      setIsOnline(!val);
    } finally {
      setIsTogglingDuty(false);
    }
  };

  const handleAcceptRide = async (rideId: number) => {
    try {
      const updatedRide = await driverService.acceptRide(rideId);
      setActiveRide(updatedRide);
      setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
      Alert.alert('Trip Accepted! 🚖', `Ride #${updatedRide.rideNumber} is now assigned to you.`);
    } catch (e: any) {
      setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
      Alert.alert(
        'Ride Unavailable',
        e.message || 'This ride has already been accepted by another driver.'
      );
      loadDriverData();
    }
  };

  const handleMarkArriving = async () => {
    if (!activeRide) return;
    try {
      await driverService.markArriving(activeRide.id);
      setActiveRide({ ...activeRide, status: 'ARRIVING' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    if (startOtpInput.length !== 4) {
      Alert.alert('Invalid OTP', 'Please ask the passenger for their 4-digit ride OTP');
      return;
    }

    setIsStartingRide(true);
    try {
      await driverService.startRide(activeRide.id, startOtpInput);
      setActiveRide({ ...activeRide, status: 'STARTED' });
      setStartOtpInput('');
      Alert.alert('Trip Started!', 'Drive safely towards the destination.');
    } catch (e: any) {
      Alert.alert('OTP Verification Failed', e.message || 'Incorrect ride OTP code. Please verify with passenger.');
    } finally {
      setIsStartingRide(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    try {
      await driverService.completeRide(activeRide.id);
      Alert.alert('Trip Completed! 🎉', `Fare settled: ₹${activeRide.estimatedFare}`);
      setActiveRide(null);
      loadDriverData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not complete ride');
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Trip',
        style: 'destructive',
        onPress: async () => {
          try {
            await driverService.cancelRide(activeRide.id, 'Driver cancelled');
            setActiveRide(null);
            loadDriverData();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not cancel ride');
          }
        },
      },
    ]);
  };

  const openDirectionsInExternalApp = (lat: number, lng: number, label: string) => {
    Alert.alert(
      'Open external maps?',
      'In-app live map is the default. External maps is only a fallback.',
      [
        { text: 'Stay in app', style: 'cancel' },
        {
          text: 'Open Maps',
          onPress: () => {
            const url = Platform.select({
              ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
              android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
              default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
            });
            if (url) {
              Linking.openURL(url).catch(() => {
                Alert.alert('Navigation Error', 'Could not open native maps application.');
              });
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Connecting to Driver Network...</Text>
      </SafeAreaView>
    );
  }

  const vehicleText = profile?.vehicle
    ? `${profile.vehicle.make} ${profile.vehicle.model} (${profile.vehicle.registrationNumber})`
    : 'Vehicle Assigned';

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormKeyboardAvoid>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadDriverData(); }} tintColor="#3B82F6" />}
      >
        {/* Driver Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.profileRow}>
            <View style={styles.driverAvatar}>
              <Ionicons name="car-sport" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{profile?.fullName || 'Active Driver'}</Text>
              <Text style={styles.vehicleSubtitle}>{vehicleText}</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>{profile?.rating.toFixed(1) || '4.9'}</Text>
                <Text style={styles.tripsText}>• {profile?.totalRides || 0} trips</Text>
              </View>
            </View>

            {/* Online Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: isOnline ? '#10B981' : '#94A3B8' }]}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
              {isTogglingDuty ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: '#334155', true: '#10B98150' }}
                  thumbColor={isOnline ? '#10B981' : '#64748B'}
                />
              )}
            </View>
          </View>
        </View>

        {/* Active Trip Section */}
        {activeRide && (
          <View style={styles.activeRideCard}>
            <View style={styles.activeRideHeader}>
              <View style={styles.activeStatusPill}>
                <View style={styles.liveDot} />
                <Text style={styles.activeStatusText}>ACTIVE TRIP — {activeRide.status}</Text>
              </View>
              <Text style={styles.activeFareText}>₹{activeRide.estimatedFare}</Text>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.stopRow}>
                <Ionicons name="radio-button-on" size={18} color="#10B981" />
                <View style={styles.stopDetails}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress} numberOfLines={2}>{activeRide.pickupAddress}</Text>
                  {pickupCoordsValid ? (
                    <Text style={styles.stopCoordsText}>
                      GPS: {Number(activeRide.pickupLatitude).toFixed(5)}, {Number(activeRide.pickupLongitude).toFixed(5)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {revealDestination ? (
                <>
                  <View style={styles.routeDivider} />
                  <View style={styles.stopRow}>
                    <Ionicons name="location" size={18} color="#EF4444" />
                    <View style={styles.stopDetails}>
                      <Text style={styles.stopLabel}>DESTINATION</Text>
                      <Text style={styles.stopAddress} numberOfLines={2}>{activeRide.dropoffAddress}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.routeDivider} />
                  <View style={styles.stopRow}>
                    <Ionicons name="lock-closed" size={18} color="#94A3B8" />
                    <View style={styles.stopDetails}>
                      <Text style={styles.stopLabel}>DESTINATION</Text>
                      <Text style={styles.stopAddress}>Hidden until passenger OTP is verified</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Captain Live Navigation Map */}
            <View style={styles.captainMapWrapper}>
              <View style={styles.mapHeaderRow}>
                <View style={styles.mapHeaderTitleRow}>
                  <Ionicons name="navigate-circle" size={18} color="#3B82F6" />
                  <Text style={styles.mapSectionTitle}>
                    {isTripStarted ? 'Trip In-Progress: Navigation to Dropoff' : 'Pickup Navigation Map'}
                  </Text>
                </View>
                {navigationDistanceText ? (
                  <View style={[styles.distanceBadge, isTripStarted && { backgroundColor: '#3B82F620' }]}>
                    <Ionicons name="speedometer-outline" size={13} color={isTripStarted ? '#3B82F6' : '#10B981'} />
                    <Text style={[styles.distanceBadgeText, isTripStarted && { color: '#3B82F6' }]}>
                      {navigationDistanceText} to {isTripStarted ? 'dropoff' : 'pickup'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {(!pickupCoordsValid && !(revealDestination && dropoffCoordsValid)) ? (
                <View style={styles.mapFallbackCard}>
                  <Ionicons name="alert-circle-outline" size={22} color="#F59E0B" />
                  <Text style={styles.mapFallbackText}>
                    GPS coordinates unavailable or invalid. Please refer to written address above.
                  </Text>
                </View>
              ) : canUseNativeMap && MapView && Camera && PointAnnotation && tokenReady ? (
                <View style={styles.nativeMapContainer}>
                  <MapView
                    style={StyleSheet.absoluteFill}
                    styleURL="mapbox://styles/mapbox/navigation-night-v1"
                    logoEnabled={false}
                    attributionEnabled={false}
                    onTouchStart={() => setFollowCamera(false)}
                  >
                    <Camera
                      ref={cameraRef}
                      zoomLevel={13}
                      centerCoordinate={
                        captainCoordsValid
                          ? [captainCoords!.longitude, captainCoords!.latitude]
                          : targetCoords
                          ? [targetCoords.longitude, targetCoords.latitude]
                          : [75.7873, 26.9124]
                      }
                      animationMode="flyTo"
                      animationDuration={400}
                    />

                    {/* Customer Pickup Location Marker - Green Pin */}
                    {pickupCoordsValid && (
                      <PointAnnotation
                        id={`pickup-marker-${activeRide.id}`}
                        coordinate={[Number(activeRide.pickupLongitude), Number(activeRide.pickupLatitude)]}
                        title="Customer Pickup Location"
                      >
                        <View style={styles.pickupMarkerWrap}>
                          <View style={styles.pickupPinHead}>
                            <Ionicons name="person" size={14} color="#FFFFFF" />
                          </View>
                          <View style={styles.pinTriangle} />
                          <View style={styles.pickupPulseDot} />
                        </View>
                      </PointAnnotation>
                    )}

                    {/* Destination only after OTP / STARTED (Phase B) */}
                    {revealDestination && dropoffCoordsValid && (
                      <PointAnnotation
                        id={`destination-marker-${activeRide.id}`}
                        coordinate={[Number(activeRide.dropoffLongitude), Number(activeRide.dropoffLatitude)]}
                        title="Destination Dropoff"
                      >
                        <View style={styles.pickupMarkerWrap}>
                          <View style={[styles.pickupPinHead, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="location" size={14} color="#FFFFFF" />
                          </View>
                          <View style={[styles.pinTriangle, { borderTopColor: '#EF4444' }]} />
                        </View>
                      </PointAnnotation>
                    )}

                    {/* Captain Live Location Marker */}
                    {captainCoordsValid && (
                      <PointAnnotation
                        id={`captain-marker-${activeRide.id}`}
                        coordinate={[captainCoords!.longitude, captainCoords!.latitude]}
                        title="Captain (Your Location)"
                      >
                        <View style={styles.captainMarkerWrap}>
                          <View style={styles.captainMarkerHead}>
                            <Ionicons name="car" size={14} color="#FFFFFF" />
                          </View>
                          <View style={styles.captainMarkerAura} />
                        </View>
                      </PointAnnotation>
                    )}

                    {/* Active Navigation Route Line */}
                    {!rideIsTerminal && routeGeoJson && ShapeSource && LineLayer ? (
                      <ShapeSource id="routeLineSource" shape={routeGeoJson}>
                        <LineLayer
                          id="routeLineLayer"
                          style={{
                            lineColor: isTripStarted ? '#10B981' : '#3B82F6',
                            lineWidth: 4,
                            lineCap: 'round',
                            lineJoin: 'round',
                          }}
                        />
                      </ShapeSource>
                    ) : null}
                  </MapView>

                  {routeLoading ? (
                    <View style={styles.routeLoadingChip}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.routeLoadingText}>Updating route…</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.recenterMapBtn}
                    onPress={handleRecenterMap}
                    accessibilityRole="button"
                    accessibilityLabel="Recenter map on route"
                  >
                    <Ionicons name="locate" size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.openExternalNavBtn}
                    onPress={() => {
                      if (targetCoords) {
                        openDirectionsInExternalApp(targetCoords.latitude, targetCoords.longitude, targetCoords.address);
                      }
                    }}
                    accessibilityLabel="Open external maps fallback"
                  >
                    <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.openExternalNavText}>External maps (optional)</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mapFallbackCard}>
                  <View style={styles.fallbackHeader}>
                    <MaterialIcons name="map" size={24} color="#3B82F6" />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.fallbackPickupTitle}>
                        {!tokenReady
                          ? 'Mapbox is not configured. In-app map unavailable.'
                          : isTripStarted
                          ? `Dropoff: ${activeRide.dropoffAddress}`
                          : `Pickup: ${activeRide.pickupAddress}`}
                      </Text>
                      {targetCoords ? (
                        <Text style={styles.fallbackCoords}>
                          Target: {targetCoords.latitude.toFixed(5)}, {targetCoords.longitude.toFixed(5)}
                        </Text>
                      ) : null}
                      {captainCoordsValid ? (
                        <Text style={styles.fallbackCaptainCoords}>
                          Captain GPS: {captainCoords!.latitude.toFixed(5)}, {captainCoords!.longitude.toFixed(5)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {targetCoords && (
                    <TouchableOpacity
                      style={styles.openExternalNavBtnFallback}
                      onPress={() => openDirectionsInExternalApp(targetCoords.latitude, targetCoords.longitude, targetCoords.address)}
                    >
                      <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.openExternalNavText}>
                        External maps fallback
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Trip Action Controls */}
            {activeRide.status === 'ACCEPTED' && (
              <View style={styles.tripActions}>
                <TouchableOpacity style={styles.arrivingBtn} onPress={handleMarkArriving}>
                  <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.btnText}>Arrived at Pickup</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelTripBtn} onPress={handleCancelRide}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeRide.status === 'ARRIVING' && (
              <View style={styles.otpVerifyContainer}>
                <Text style={styles.otpPrompt}>Ask Passenger for 4-Digit Ride OTP:</Text>
                <View style={styles.otpInputRow}>
                  <TextInput
                    style={styles.otpTextInput}
                    placeholder="Enter OTP (e.g. 4829)"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={startOtpInput}
                    onChangeText={setStartOtpInput}
                  />
                  <TouchableOpacity
                    style={[styles.startTripBtn, isStartingRide && styles.btnDisabled]}
                    onPress={handleStartRide}
                    disabled={isStartingRide}
                  >
                    {isStartingRide ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnText}>Verify & Start</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cancelTripBtn} onPress={handleCancelRide}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeRide.status === 'STARTED' && (
              <View style={styles.tripActions}>
                <TouchableOpacity style={styles.completeTripBtn} onPress={handleCompleteRide}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.btnText}>Complete Trip & Collect ₹{activeRide.estimatedFare}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.mapNoticeRow}>
              <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
              <Text style={styles.mapNoticeText}>Turn-by-turn road navigation is powered by live device GPS.</Text>
            </View>
          </View>
        )}

        {/* Offline Warning Banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={22} color="#F59E0B" />
            <View style={styles.offlineBannerText}>
              <Text style={styles.offlineTitle}>You are currently OFFLINE</Text>
              <Text style={styles.offlineSubtitle}>Switch duty to Online above to receive ride requests.</Text>
            </View>
          </View>
        )}

        {/* Live Available Trip Requests */}
        {isOnline && !activeRide && (
          <View style={styles.availableSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Trips Near You</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{availableRides.length}</Text>
              </View>
            </View>

            {availableRides.length === 0 ? (
              <View style={styles.emptyRequestsCard}>
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyRequestsTitle}>Listening for ride requests...</Text>
                <Text style={styles.emptyRequestsSubtitle}>
                  Stay on this screen. New passenger booking requests will pop up here instantly.
                </Text>
              </View>
            ) : (
              availableRides.map((ride) => (
                <View key={ride.id} style={styles.requestCard}>
                  <View style={styles.requestCardHeader}>
                    <View style={styles.passengerRow}>
                      <Ionicons name="person-circle" size={24} color="#3B82F6" />
                      <Text style={styles.passengerName}>{ride.customerName}</Text>
                    </View>
                    <Text style={styles.fareTag}>₹{ride.fare}</Text>
                  </View>

                  <View style={styles.requestRoute}>
                    <View style={styles.routeItem}>
                      <Ionicons name="radio-button-on" size={14} color="#10B981" />
                      <Text style={styles.routeAddress} numberOfLines={1}>{ride.pickupAddress}</Text>
                    </View>
                    <View style={styles.routeItem}>
                      <Ionicons name="location" size={14} color="#EF4444" />
                      <Text style={styles.routeAddress} numberOfLines={1}>{ride.dropoffAddress}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.acceptBtn}
                    activeOpacity={0.8}
                    onPress={() => handleAcceptRide(ride.id)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.acceptBtnText}>ACCEPT TRIP</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      </FormKeyboardAvoid>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } as any,
    }),
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  vehicleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 3,
  },
  tripsText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginLeft: 6,
  },
  toggleContainer: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeRideCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    ...Platform.select({
      ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(59,130,246,0.15)' } as any,
    }),
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F620',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 6,
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3B82F6',
  },
  activeFareText: {
    ...typography.h3,
    color: '#10B981',
  },
  routeContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopDetails: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  stopAddress: {
    ...typography.bodySm,
    color: colors.textPrimary,
    marginTop: 2,
  },
  routeDivider: {
    height: 14,
    width: 1.5,
    backgroundColor: colors.border,
    marginLeft: 8,
    marginVertical: 4,
  },
  tripActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrivingBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: 6,
  },
  completeTripBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: 6,
  },
  cancelTripBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF444450',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  otpVerifyContainer: {
    marginBottom: spacing.xs,
  },
  otpPrompt: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  otpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  otpTextInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  startTripBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  mapNoticeText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginLeft: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B15',
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  offlineBannerText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  offlineTitle: {
    ...typography.h4,
    color: '#F59E0B',
  },
  offlineSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  availableSection: {
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: '#3B82F625',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3B82F6',
  },
  emptyRequestsCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyRequestsTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyRequestsSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.03)' } as any,
    }),
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passengerName: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  fareTag: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  requestRoute: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: 10,
    gap: 6,
    marginBottom: spacing.md,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeAddress: {
    ...typography.bodySm,
    color: colors.textPrimary,
    flex: 1,
  },
  acceptBtn: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stopCoordsText: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  captainMapWrapper: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#3B82F640',
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  mapHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  nativeMapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginTop: spacing.xs,
  },
  pickupMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadowStyle({ offsetY: 2, opacity: 0.3, radius: 3, elevation: 4 }),
  },
  pinTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
    marginTop: -1,
  },
  pickupPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginTop: 2,
  },
  captainMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainMarkerHead: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadowStyle({ offsetY: 2, opacity: 0.4, radius: 4, elevation: 5 }),
  },
  captainMarkerAura: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F630',
    zIndex: -1,
  },
  recenterMapBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172AEE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3B82F680',
  },
  routeLoadingChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172ACC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  routeLoadingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  openExternalNavBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#0F172AEE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#64748B80',
  },
  openExternalNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mapFallbackCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  mapFallbackText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fallbackPickupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fallbackCoords: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fallbackCaptainCoords: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  openExternalNavBtnFallback: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: spacing.sm,
  },
});
