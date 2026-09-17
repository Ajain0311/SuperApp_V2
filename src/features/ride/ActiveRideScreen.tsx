import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const ActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActiveRide'>>();
  const rideId = route.params?.rideId || 'RD-5021';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Ride</Text>
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
              <Text style={styles.transitStatusText}>Rapido Bike In Transit</Text>
            </View>
            <Text style={styles.arrivalEtaText}>3 mins away (0.8 km)</Text>
          </View>
          <View style={styles.vehicleTypeCircle}>
            <MaterialIcons name="two-wheeler" size={28} color={colors.secondary} />
          </View>
        </View>

        {/* Start Ride OTP Box */}
        <View style={styles.otpBox}>
          <Text style={styles.otpTitle}>START RIDE OTP</Text>
          <View style={styles.otpDigitsRow}>
            {['4', '8', '2', '9'].map((digit, idx) => (
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
              <Text style={styles.driverName}>Amit Singh</Text>
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={14} color={colors.yellow} />
                <Text style={styles.ratingNumber}>4.9</Text>
                <Text style={styles.tripsCount}> (1,240 trips)</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.callButton}>
              <MaterialIcons name="call" size={20} color={colors.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chatButton}>
              <MaterialIcons name="chat-bubble-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.vehicleRow}>
            <View>
              <Text style={styles.vehicleModelLabel}>VEHICLE MODEL</Text>
              <Text style={styles.vehicleModelName}>Hero Splendor Plus (Black)</Text>
            </View>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>DL 04 AB 9821</Text>
            </View>
          </View>
        </View>

        {/* Trip Stepper */}
        <View style={styles.stepperCard}>
          <Text style={styles.stepperTitle}>Trip Status</Text>

          <View style={styles.stepperBody}>
            {/* Step 1 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleDone]}>
                <MaterialIcons name="check" size={12} color={colors.secondary} />
              </View>
              <View style={styles.stepTextContent}>
                <Text style={styles.stepTitleDone}>Driver Assigned</Text>
                <Text style={styles.stepSubtitle}>Amit accepted your ride request</Text>
              </View>
            </View>
            <View style={[styles.stepLine, styles.stepLineDone]} />

            {/* Step 2 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleActive]}>
                <MaterialIcons name="check" size={12} color={colors.primary} />
              </View>
              <View style={styles.stepTextContent}>
                <Text style={styles.stepTitleActive}>Arriving at Pickup</Text>
                <Text style={styles.stepSubtitle}>Driver is 3 mins away at Janpath</Text>
              </View>
            </View>
            <View style={styles.stepLine} />

            {/* Step 3 */}
            <View style={styles.stepItem}>
              <View style={styles.stepCircle} />
              <View style={styles.stepTextContent}>
                <Text style={styles.stepTitlePending}>Ride Started</Text>
                <Text style={styles.stepSubtitle}>Heading to Terminal 3, IGI Airport</Text>
              </View>
            </View>
            <View style={styles.stepLine} />

            {/* Step 4 */}
            <View style={styles.stepItem}>
              <View style={styles.stepCircle} />
              <View style={styles.stepTextContent}>
                <Text style={styles.stepTitlePending}>Drop-off Completed</Text>
                <Text style={styles.stepSubtitle}>Pay ₹45 via Cash or UPI</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cancel Ride Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.cancelButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Text style={styles.cancelButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      </ScrollView>
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
  vehicleModelLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  vehicleModelName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  plateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.0,
    color: colors.textPrimary,
  },
  stepperCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  stepperTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 14,
  },
  stepperBody: {
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
