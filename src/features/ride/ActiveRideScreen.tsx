import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
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

export const ActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>();
  const rideId = route.params?.rideId || 'RD-5021';
  const rideNumericId = route.params?.rideNumericId;
  const initialRideData = route.params?.rideData;

  const [driverId, setDriverId] = useState<number>(initialRideData?.driver?.id || 1);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>(initialRideData?.otpCode || '4829');
  const [driverName, setDriverName] = useState<string>(initialRideData?.driver?.fullName || 'Searching Driver...');
  const [driverRating, setDriverRating] = useState<string>(
    initialRideData?.driver?.rating ? String(initialRideData.driver.rating) : '4.9'
  );
  const [driverTrips, setDriverTrips] = useState<string>(
    initialRideData?.driver?.totalRides ? `(${initialRideData.driver.totalRides} trips)` : '(1,240 trips)'
  );
  const [vehicleModel, setVehicleModel] = useState<string>(
    initialRideData?.driver?.vehicleModel || 'Standard Vehicle'
  );
  const [registrationNumber, setRegistrationNumber] = useState<string>(
    initialRideData?.driver?.registrationNumber || 'DL 04 AB 9821'
  );
  const [transitStatus, setTransitStatus] = useState<string>(
    initialRideData?.driver ? 'Driver Assigned & In Transit' : 'Searching for Nearest Driver'
  );
  const [arrivalEta, setArrivalEta] = useState<string>('3 mins away (0.8 km)');
  const [fareText, setFareText] = useState<string>(
    initialRideData?.estimatedFare ? `₹${initialRideData.estimatedFare}` : '₹45'
  );
  const [rideStatus, setRideStatus] = useState<string>(initialRideData?.status || 'REQUESTED');
  const [isCancelling, setIsCancelling] = useState(false);

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
          if (data.rideId === rideNumericId) {
            setArrivalEta(`Driver updating: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`);
          }
        });

        unsubStatus = signalRService.onRideStatusChanged((data: RideStatusEvent) => {
          if (data.rideId === rideNumericId) {
            setRideStatus(data.status);
            if (data.status === 'ARRIVING') {
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
          if (driver) {
            if (driver.id) setDriverId(driver.id);
            if (driver.fullName) setDriverName(driver.fullName);
            if (driver.rating) setDriverRating(String(driver.rating));
            if (driver.totalRides) setDriverTrips(`(${driver.totalRides} trips)`);
            if (driver.vehicleModel) setVehicleModel(driver.vehicleModel);
            if (driver.registrationNumber) setRegistrationNumber(driver.registrationNumber);
            setTransitStatus('Driver Assigned & In Transit');
            setRideStatus('ACCEPTED');
          }
        });
      })
      .catch(() => {});

    return () => {
      if (rideNumericId) {
        signalRService.leaveRide(rideNumericId);
      }
      if (unsubLocation) unsubLocation();
      if (unsubStatus) unsubStatus();
      if (unsubAssigned) unsubAssigned();
    };
  }, [rideNumericId]);

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
              <View style={styles.greenPulseDot} />
              <Text style={styles.transitStatusText}>{transitStatus}</Text>
            </View>
            <Text style={styles.arrivalEtaText}>{arrivalEta}</Text>
          </View>
          <View style={styles.vehicleTypeCircle}>
            <MaterialIcons name="two-wheeler" size={28} color={colors.secondary} />
          </View>
        </View>

        {/* Start Ride OTP Box */}
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

        {/* Driver & Vehicle Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverHeaderRow}>
            <View style={styles.driverAvatar}>
              <MaterialIcons name="person" size={30} color={colors.secondary} />
            </View>

            <View style={styles.driverMeta}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={14} color={colors.yellow} />
                <Text style={styles.ratingNumber}>{driverRating}</Text>
                <Text style={styles.tripsCount}> {driverTrips}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => Alert.alert('Calling Driver', `Calling ${driverName}...`)}
            >
              <MaterialIcons name="call" size={20} color={colors.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => Alert.alert('Chat Driver', `Opening chat with ${driverName}...`)}
            >
              <MaterialIcons name="chat-bubble-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.vehicleRow}>
            <View style={styles.vehicleModelInfo}>
              <Text style={styles.vehicleModelText}>{vehicleModel}</Text>
              <Text style={styles.vehicleColorText}>Verified Commercial Vehicle</Text>
            </View>
            <View style={styles.regNumberBadge}>
              <Text style={styles.regNumberText}>{registrationNumber}</Text>
            </View>
          </View>
        </View>

        {/* Live Trip Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>TRIP PROGRESS</Text>

          <View style={styles.timelineSteps}>
            {/* Step 1 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleDone]}>
                <MaterialIcons name="check" size={12} color="#FFFFFF" />
              </View>
              <View style={styles.stepTextContent}>
                <Text style={styles.stepTitleDone}>Driver Assigned</Text>
                <Text style={styles.stepSubtitle}>{driverName} accepted your ride request</Text>
              </View>
            </View>
            <View style={[styles.stepLine, styles.stepLineDone]} />

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
      <RatingModal
        visible={showRatingModal}
        targetType="DRIVER"
        targetId={driverId}
        title="Rate Your Driver"
        subtitle={driverName}
        onClose={() => setShowRatingModal(false)}
      />
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
});
