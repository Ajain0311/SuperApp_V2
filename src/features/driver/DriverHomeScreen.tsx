import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { driverService, DriverProfile, DriverRideItem } from '../../services/driverService';
import { signalRService } from '../../services/signalr';
import { locationService } from '../../services/locationService';
import { useRoleStore } from '../../store/roleStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const DriverHomeScreen: React.FC = () => {
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
  const locationWatcherRef = useRef<(() => void) | null>(null);

  const loadDriverData = useCallback(async () => {
    try {
      const p = await driverService.getProfile();
      setProfile(p);
      setIsOnline(p.isOnline);

      const [active, available] = await Promise.all([
        driverService.getActiveRide(),
        p.isOnline ? driverService.getAvailableRides() : Promise.resolve([]),
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

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  // Real-time SignalR driver pool and active ride tracking
  useEffect(() => {
    let unregisterStatus: (() => void) | null = null;

    const setupSignalR = async () => {
      try {
        const hub = await signalRService.connectRideHub();
        if (hub) {
          // Join driver pool
          await hub.invoke('JoinDriversPool').catch(() => {});

          if (activeRide?.id) {
            await hub.invoke('JoinRide', activeRide.id).catch(() => {});
          }

          unregisterStatus = signalRService.onRideStatusChanged((event) => {
            if (activeRide && event.rideId === activeRide.id) {
              setActiveRide((prev: any) => prev ? { ...prev, status: event.status } : null);
              if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
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
      if (unregisterStatus) unregisterStatus();
    };
  }, [activeRide?.id, loadDriverData]);

  // Foreground GPS tracking only when Online and has an active trip
  useEffect(() => {
    if (isOnline && activeRide && (activeRide.status === 'ACCEPTED' || activeRide.status === 'ARRIVING' || activeRide.status === 'STARTED')) {
      const startTracking = async () => {
        try {
          const unsub = await locationService.watchLocation(
            async (coords) => {
              try {
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
      Alert.alert('Trip Accepted!', `Ride #${updatedRide.rideNumber} is now assigned to you.`);
    } catch (e: any) {
      Alert.alert('Accept Failed', e.message || 'This ride is no longer available');
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
      <ScrollView
        contentContainerStyle={styles.container}
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
                  <Text style={styles.stopLabel}>PICKUP</Text>
                  <Text style={styles.stopAddress} numberOfLines={2}>{activeRide.pickupAddress}</Text>
                </View>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.stopRow}>
                <Ionicons name="location" size={18} color="#EF4444" />
                <View style={styles.stopDetails}>
                  <Text style={styles.stopLabel}>DESTINATION</Text>
                  <Text style={styles.stopAddress} numberOfLines={2}>{activeRide.dropoffAddress}</Text>
                </View>
              </View>
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
              <Text style={styles.offlineSubtitle}>Switch duty to Online above to receive incoming passenger trip requests.</Text>
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
});
