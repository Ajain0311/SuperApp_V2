import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { signalRService, DriverLocationEvent, RideStatusEvent } from '../../services/signalr';
import { apiClient } from '../../services/apiClient';
import { ApiEndpoints } from '../../constants/api';
import { RatingModal } from '../../components/RatingModal';
import { LocationMapPicker } from '../../components/maps/LocationMapPicker';
import { locationService } from '../../services/locationService';

export const ActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>();
  const rideId = route.params?.rideId || 'RD-5021';
  const rideNumericId = route.params?.rideNumericId;
  const initialRideData = route.params?.rideData;

  const [driverId, setDriverId] = useState<number | null>(initialRideData?.driver?.id || null);
  const [driverPhone, setDriverPhone] = useState<string>(initialRideData?.driver?.phone || '');
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>(initialRideData?.otpCode || '');
  const [driverName, setDriverName] = useState<string>(initialRideData?.driver?.fullName || '');
  const [driverRating, setDriverRating] = useState<string>(
    initialRideData?.driver?.rating ? String(initialRideData.driver.rating) : ''
  );
  const [driverTrips, setDriverTrips] = useState<string>(
    initialRideData?.driver?.totalRides ? `(${initialRideData.driver.totalRides} trips)` : ''
  );
  const [vehicleModel, setVehicleModel] = useState<string>(
    initialRideData?.driver?.vehicleModel || ''
  );
  const [registrationNumber, setRegistrationNumber] = useState<string>(
    initialRideData?.driver?.registrationNumber || ''
  );
  const [vehicleType, setVehicleType] = useState<string>(
    initialRideData?.vehicleType || 'BIKE'
  );
  const [pickupAddress, setPickupAddress] = useState<string>(
    initialRideData?.pickupAddress || ''
  );
  const [dropoffAddress, setDropoffAddress] = useState<string>(
    initialRideData?.dropoffAddress || ''
  );
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialRideData?.pickupLatitude && initialRideData?.pickupLongitude
      ? { latitude: Number(initialRideData.pickupLatitude), longitude: Number(initialRideData.pickupLongitude) }
      : null
  );
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialRideData?.driver?.currentLatitude && initialRideData?.driver?.currentLongitude
      ? {
          latitude: Number(initialRideData.driver.currentLatitude),
          longitude: Number(initialRideData.driver.currentLongitude),
        }
      : null
  );
  const [transitStatus, setTransitStatus] = useState<string>(
    initialRideData?.driver ? 'Driver Assigned & Approaching' : 'Finding your driver…'
  );
  const [arrivalEta, setArrivalEta] = useState<string>(
    initialRideData?.driver ? 'Driver is on the way' : 'Waiting for driver assignment'
  );
  const [fareText, setFareText] = useState<string>(
    initialRideData?.estimatedFare ? `₹${initialRideData.estimatedFare}` : '--'
  );
  const [rideStatus, setRideStatus] = useState<string>(initialRideData?.status || 'REQUESTED');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLocationUpdating, setIsLocationUpdating] = useState(false);
  const isMountedRef = useRef(true);

  // Synchronize state from API ride details
  const applyRideDetails = (ride: any) => {
    if (!ride || !isMountedRef.current) return;
    if (ride.status) setRideStatus(ride.status);
    if (ride.otpCode) setOtpCode(ride.otpCode);
    if (ride.vehicleType) setVehicleType(ride.vehicleType);
    if (ride.pickupAddress) setPickupAddress(ride.pickupAddress);
    if (ride.dropoffAddress) setDropoffAddress(ride.dropoffAddress);
    if (ride.estimatedFare) setFareText(`₹${ride.estimatedFare}`);
    if (ride.pickupLatitude && ride.pickupLongitude) {
      setPickupCoords({
        latitude: Number(ride.pickupLatitude),
        longitude: Number(ride.pickupLongitude),
      });
    }

    if (ride.driver) {
      const d = ride.driver;
      if (d.id) setDriverId(d.id);
      if (d.fullName) setDriverName(d.fullName);
      if (d.phone) setDriverPhone(d.phone);
      if (d.rating) setDriverRating(String(d.rating));
      if (d.totalRides) setDriverTrips(`(${d.totalRides} trips)`);
      if (d.vehicleModel) setVehicleModel(d.vehicleModel);
      if (d.registrationNumber) setRegistrationNumber(d.registrationNumber);
      if (d.currentLatitude && d.currentLongitude) {
        setDriverCoords({
          latitude: Number(d.currentLatitude),
          longitude: Number(d.currentLongitude),
        });
      }

      if (ride.status === 'REQUESTED' || ride.status === 'SEARCHING') {
        setTransitStatus('Finding your driver…');
        setArrivalEta('Waiting for driver assignment');
      } else if (ride.status === 'ACCEPTED') {
        setTransitStatus('Driver Assigned & Approaching');
        setArrivalEta('Driver is on the way');
      } else if (ride.status === 'ARRIVING') {
        setTransitStatus('Driver Arrived at Pickup');
        setArrivalEta('Waiting for passenger');
      } else if (ride.status === 'STARTED') {
        setTransitStatus('Ride in Progress');
        setArrivalEta('Heading to Destination');
      } else if (ride.status === 'COMPLETED') {
        setTransitStatus('Ride Completed');
        setArrivalEta('Arrived at Destination');
      } else if (ride.status === 'CANCELLED') {
        setTransitStatus('Ride Cancelled');
        setArrivalEta('Trip Terminated');
      }
    } else {
      setDriverId(null);
      setDriverName('');
      setDriverPhone('');
      setTransitStatus('Finding your driver…');
      setArrivalEta('Waiting for driver assignment');
    }
  };

  // Initial hydrate from authorized backend endpoint
  useEffect(() => {
    isMountedRef.current = true;
    if (!rideNumericId) return;

    apiClient
      .get<any>(ApiEndpoints.ride.detail(rideNumericId))
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) {
          applyRideDetails(data);
        }
      })
      .catch((err) => {
        console.warn('[ActiveRide] Initial ride hydration error:', err);
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [rideNumericId]);

  // Subscribe to SignalR events and join group
  useEffect(() => {
    if (!rideNumericId) return;

    let unsubLocation: (() => void) | undefined;
    let unsubStatus: (() => void) | undefined;
    let unsubAssigned: (() => void) | undefined;

    signalRService
      .connectRideHub()
      .then(() => {
        signalRService.joinRide(rideNumericId);

        unsubLocation = signalRService.onDriverLocationUpdated((data: DriverLocationEvent) => {
          if (data.rideId === rideNumericId && isMountedRef.current) {
            setDriverCoords({ latitude: data.latitude, longitude: data.longitude });
            setIsLocationUpdating(true);
            setTimeout(() => {
              if (isMountedRef.current) setIsLocationUpdating(false);
            }, 2000);

            // Compute distance to pickup if available
            if (pickupCoords) {
              const distKm = locationService.calculateDistanceKm(
                data.latitude,
                data.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude
              );
              const mins = locationService.estimateDurationMinutes(distKm);
              setArrivalEta(`~${mins} mins away (${distKm} km)`);
            } else {
              setArrivalEta('Driver is on the way');
            }
          }
        });

        unsubStatus = signalRService.onRideStatusChanged((data: RideStatusEvent) => {
          if (data.rideId === rideNumericId && isMountedRef.current) {
            setRideStatus(data.status);
            if (data.status === 'ACCEPTED') {
              setTransitStatus('Driver Assigned & Approaching');
              setArrivalEta('Driver is on the way');
            } else if (data.status === 'ARRIVING') {
              setTransitStatus('Driver Arrived at Pickup');
              setArrivalEta('Waiting for passenger');
            } else if (data.status === 'STARTED') {
              setTransitStatus('Ride in Progress');
              setArrivalEta('Heading to Destination');
            } else if (data.status === 'COMPLETED') {
              setTransitStatus('Ride Completed');
              setArrivalEta('Arrived at Destination');
            } else if (data.status === 'CANCELLED') {
              setTransitStatus('Ride Cancelled');
              setArrivalEta('Trip Terminated');
            }
          }
        });

        unsubAssigned = signalRService.onDriverAssigned((driver: any) => {
          if (driver && isMountedRef.current) {
            if (driver.id) setDriverId(driver.id);
            if (driver.fullName) setDriverName(driver.fullName);
            if (driver.phone) setDriverPhone(driver.phone);
            if (driver.rating) setDriverRating(String(driver.rating));
            if (driver.totalRides) setDriverTrips(`(${driver.totalRides} trips)`);
            if (driver.vehicleModel) setVehicleModel(driver.vehicleModel);
            if (driver.registrationNumber) setRegistrationNumber(driver.registrationNumber);
            if (driver.currentLatitude && driver.currentLongitude) {
              setDriverCoords({
                latitude: Number(driver.currentLatitude),
                longitude: Number(driver.currentLongitude),
              });
            }
            setTransitStatus('Driver Assigned & Approaching');
            setRideStatus('ACCEPTED');
            setArrivalEta('Driver is on the way');
          }
        });
      })
      .catch((err) => {
        console.warn('[ActiveRide] SignalR subscription error:', err);
      });

    return () => {
      if (rideNumericId) {
        signalRService.leaveRide(rideNumericId);
      }
      if (unsubLocation) unsubLocation();
      if (unsubStatus) unsubStatus();
      if (unsubAssigned) unsubAssigned();
    };
  }, [rideNumericId, pickupCoords]);

  const handleCallDriver = () => {
    if (!driverPhone || !driverPhone.trim()) {
      Alert.alert('Phone Unavailable', 'Driver phone number is not available yet.');
      return;
    }
    const cleanNumber = driverPhone.replace(/[^\d+]/g, '');
    if (!cleanNumber || cleanNumber.length < 5) {
      Alert.alert('Invalid Number', 'Driver phone number is not valid.');
      return;
    }
    const telUrl = `tel:${cleanNumber}`;
    Linking.canOpenURL(telUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(telUrl);
        } else {
          Alert.alert('Driver Phone', `Your driver's phone number is:\n${driverPhone}`);
        }
      })
      .catch(() => {
        Alert.alert('Driver Phone', `Your driver's phone number is:\n${driverPhone}`);
      });
  };

  const handleOpenChat = () => {
    Alert.alert(
      'In-App Chat',
      'Driver chat is currently in maintenance. Please use the Call button to contact your driver.'
    );
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              if (rideNumericId) {
                await apiClient.post(ApiEndpoints.ride.cancel(rideNumericId));
              }
              Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
              navigation.navigate('MainTabs', { screen: 'Home' });
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Unable to cancel ride.';
              Alert.alert('Cancel Error', msg);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  const otpDigits = otpCode.split('').slice(0, 4);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          testID="active-ride-back-btn"
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Ride ({rideId})</Text>
        <View style={styles.sosChip}>
          <MaterialIcons name="shield" size={14} color={colors.error} />
          <Text style={styles.sosText}>SOS Emergency</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status & Arrival Card */}
        <View style={styles.arrivalCard}>
          <View style={styles.arrivalInfo}>
            <View style={styles.transitStatusRow}>
              <View style={[styles.greenPulseDot, !driverId && { backgroundColor: colors.primary }]} />
              <Text style={[styles.transitStatusText, !driverId && { color: colors.primary }]}>{transitStatus}</Text>
              {isLocationUpdating && (
                <View style={styles.liveLocationBadge}>
                  <ActivityIndicator size="small" color={colors.secondary} />
                  <Text style={styles.liveLocationText}>Live GPS</Text>
                </View>
              )}
            </View>
            <Text style={styles.arrivalEtaText}>{arrivalEta}</Text>
          </View>
          <View style={styles.vehicleTypeCircle}>
            <MaterialIcons
              name={vehicleType === 'CAB' ? 'directions-car' : vehicleType === 'AUTO' ? 'electric-rickshaw' : 'two-wheeler'}
              size={28}
              color={colors.secondary}
            />
          </View>
        </View>

        {/* Live Driver & Pickup Map */}
        {(driverCoords || pickupCoords) && (
          <View style={styles.mapContainer}>
            <LocationMapPicker
              label={driverCoords ? 'LIVE DRIVER LOCATION' : 'PICKUP LOCATION'}
              initialCoordinate={driverCoords || pickupCoords || undefined}
              initialAddress={driverCoords ? 'Driver Location' : pickupAddress}
              height={220}
              hideSearchInput={true}
              onSelect={() => {}}
            />
          </View>
        )}

        {/* Start Ride OTP Box */}
        {otpCode ? (
          <View style={styles.otpBox}>
            <Text style={styles.otpTitle}>START RIDE OTP</Text>
            <View style={styles.otpDigitsRow}>
              {otpDigits.map((digit, idx) => (
                <View key={idx} style={styles.otpDigitBox}>
                  <Text style={styles.otpDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.otpSubtitle}>
              Share this code only after sitting on the vehicle
            </Text>
          </View>
        ) : null}

        {/* Driver & Vehicle Card - Rendered only when driver is assigned */}
        {driverId ? (
          <View style={styles.driverCard}>
            <View style={styles.driverHeaderRow}>
              <View style={styles.driverAvatar}>
                <MaterialIcons name="person" size={30} color={colors.secondary} />
              </View>

              <View style={styles.driverMeta}>
                <Text style={styles.driverName}>{driverName || 'Captain'}</Text>
                {driverRating ? (
                  <View style={styles.ratingRow}>
                    <MaterialIcons name="star" size={14} color={colors.yellow} />
                    <Text style={styles.ratingNumber}>{driverRating}</Text>
                    {driverTrips ? <Text style={styles.tripsCount}> {driverTrips}</Text> : null}
                  </View>
                ) : (
                  <Text style={styles.tripsCount}>Verified Driver</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.callButton, !driverPhone && { opacity: 0.5 }]}
                onPress={handleCallDriver}
                accessibilityRole="button"
                accessibilityLabel="Call Driver"
              >
                <MaterialIcons name="call" size={20} color={colors.secondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chatButton}
                onPress={handleOpenChat}
                accessibilityRole="button"
                accessibilityLabel="Chat Driver"
              >
                <MaterialIcons name="chat-bubble-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.vehicleRow}>
              <View style={styles.vehicleModelInfo}>
                <Text style={styles.vehicleModelText}>{vehicleModel || 'Standard Vehicle'}</Text>
                <Text style={styles.vehicleColorText}>Verified Commercial Vehicle</Text>
              </View>
              {registrationNumber ? (
                <View style={styles.regNumberBadge}>
                  <Text style={styles.regNumberText}>{registrationNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.searchingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.searchingCardTitle}>Connecting with nearby drivers</Text>
            <Text style={styles.searchingCardSubtitle}>
              Please hold on while drivers in your area review your ride request.
            </Text>
          </View>
        )}

        {/* Live Trip Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>TRIP PROGRESS</Text>

          <View style={styles.timelineSteps}>
            {/* Step 1 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, driverId ? styles.stepCircleDone : styles.stepCircleActive]}>
                <MaterialIcons name={driverId ? 'check' : 'hourglass-empty'} size={12} color={driverId ? '#FFFFFF' : colors.primary} />
              </View>
              <View style={styles.stepTextContent}>
                <Text style={driverId ? styles.stepTitleDone : styles.stepTitleActive}>
                  {driverId ? 'Driver Assigned' : 'Finding Driver'}
                </Text>
                <Text style={styles.stepSubtitle}>
                  {driverId ? `${driverName} accepted your ride request` : 'Searching nearest drivers in pool'}
                </Text>
              </View>
            </View>
            <View style={[styles.stepLine, driverId ? styles.stepLineDone : null]} />

            {/* Step 2 */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  rideStatus === 'ACCEPTED' ? styles.stepCircleActive : styles.stepCircleDone,
                ]}
              >
                <MaterialIcons
                  name="check"
                  size={12}
                  color={rideStatus === 'ACCEPTED' ? colors.primary : '#FFFFFF'}
                />
              </View>
              <View style={styles.stepTextContent}>
                <Text
                  style={
                    rideStatus === 'ACCEPTED' ? styles.stepTitleActive : styles.stepTitleDone
                  }
                >
                  Arriving at Pickup
                </Text>
                <Text style={styles.stepSubtitle}>Driver is on the way</Text>
              </View>
            </View>
            <View
              style={[
                styles.stepLine,
                rideStatus === 'STARTED' || rideStatus === 'COMPLETED'
                  ? styles.stepLineDone
                  : null,
              ]}
            />

            {/* Step 3 */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  rideStatus === 'STARTED'
                    ? styles.stepCircleActive
                    : rideStatus === 'COMPLETED'
                    ? styles.stepCircleDone
                    : null,
                ]}
              />
              <View style={styles.stepTextContent}>
                <Text
                  style={
                    rideStatus === 'STARTED'
                      ? styles.stepTitleActive
                      : rideStatus === 'COMPLETED'
                      ? styles.stepTitleDone
                      : styles.stepTitlePending
                  }
                >
                  Ride Started
                </Text>
                <Text style={styles.stepSubtitle}>Heading to Terminal 3, IGI Airport</Text>
              </View>
            </View>
            <View
              style={[styles.stepLine, rideStatus === 'COMPLETED' ? styles.stepLineDone : null]}
            />

            {/* Step 4 */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  rideStatus === 'COMPLETED' ? styles.stepCircleActive : null,
                ]}
              />
              <View style={styles.stepTextContent}>
                <Text
                  style={
                    rideStatus === 'COMPLETED'
                      ? styles.stepTitleActive
                      : styles.stepTitlePending
                  }
                >
                  Drop-off Completed
                </Text>
                <Text style={styles.stepSubtitle}>Pay {fareText} via Cash or UPI</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rate Driver Button when Completed */}
        {rideStatus === 'COMPLETED' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.rateButton}
            onPress={() => setShowRatingModal(true)}
          >
            <MaterialIcons name="star" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.rateButtonText}>Rate Your Driver</Text>
          </TouchableOpacity>
        )}

        {/* Cancel Ride Button */}
        {rideStatus !== 'COMPLETED' && rideStatus !== 'CANCELLED' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.cancelButton, isCancelling && { opacity: 0.7 }]}
            disabled={isCancelling}
            onPress={handleCancelRide}
          >
            <Text style={styles.cancelButtonText}>
              {isCancelling ? 'Cancelling...' : 'Cancel Ride'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Driver Rating Modal */}
      {driverId ? (
        <RatingModal
          visible={showRatingModal}
          targetType="DRIVER"
          targetId={driverId}
          title="Rate Your Driver"
          subtitle={driverName}
          onClose={() => setShowRatingModal(false)}
        />
      ) : null}
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
  sosChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 83, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.4)',
    gap: 4,
  },
  sosText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.error,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  arrivalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.4)',
  },
  arrivalInfo: {
    flex: 1,
  },
  transitStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  transitStatusText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '700',
  },
  arrivalEtaText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  vehicleTypeCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  otpTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },
  otpDigitsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  otpDigitBox: {
    width: 48,
    height: 54,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigitText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  otpSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  driverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMeta: {
    flex: 1,
    marginLeft: 14,
  },
  driverName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  ratingNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tripsCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleModelInfo: {
    flex: 1,
  },
  vehicleModelText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  vehicleColorText: {
    ...typography.caption,
    color: colors.secondary,
    marginTop: 2,
  },
  regNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regNumberText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.0,
    color: colors.textPrimary,
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  timelineSteps: {
    paddingLeft: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    borderColor: colors.secondary,
    backgroundColor: 'rgba(0, 200, 83, 0.2)',
  },
  stepCircleActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  stepLine: {
    width: 2,
    height: 18,
    backgroundColor: colors.border,
    marginLeft: 9,
  },
  stepLineDone: {
    backgroundColor: colors.secondary,
  },
  stepTextContent: {
    marginLeft: 12,
  },
  stepTitleDone: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepTitleActive: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  stepTitlePending: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stepSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  rateButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  rateButtonText: {
    ...typography.bodyLarge,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  liveLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  liveLocationText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
  },
  mapContainer: {
    marginTop: spacing.md,
    borderRadius: 18,
    overflow: 'hidden',
  },
  searchingCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingCardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 12,
  },
  searchingCardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
});
