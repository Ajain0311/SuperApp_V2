import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface VehicleOption {
  type: string;
  name: string;
  tag: string;
  tagColor: string;
  subtitle: string;
  fare: number;
  icon: keyof typeof MaterialIcons.glyphMap;
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

  const selectedVehicle = VEHICLES[selectedIndex];

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
        <Text style={styles.headerTitle}>Find Your Ride</Text>
        <View style={styles.gpsChip}>
          <MaterialIcons name="gps-fixed" size={13} color={colors.secondary} />
          <Text style={styles.gpsText}>GPS Online</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Pickup / Dropoff Card */}
        <View style={styles.card}>
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <View style={styles.locationTextGroup}>
              <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
              <Text style={styles.locationValue}>Connaught Place, Central Delhi</Text>
            </View>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLineVertical} />
            <View style={styles.dividerHorizontal} />
          </View>

          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: colors.error }]} />
            <View style={styles.locationTextGroup}>
              <Text style={styles.locationLabel}>DESTINATION</Text>
              <Text style={styles.locationValue}>Terminal 3, IGI Airport (DEL)</Text>
            </View>
          </View>
        </View>

        {/* Route Metrics Badge */}
        <View style={styles.metricsBadge}>
          <MaterialIcons name="alt-route" size={16} color={colors.blue} />
          <Text style={styles.metricsText}>16.4 km • ~34 mins • Moderate Traffic</Text>
        </View>

        {/* Mock Map Visualizer */}
        <View style={styles.mapVisualizer}>
          {/* Pickup Marker */}
          <View style={styles.pickupMarker}>
            <View style={[styles.markerCircle, { backgroundColor: colors.secondary }]}>
              <MaterialIcons name="my-location" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.markerText}>Pickup</Text>
          </View>

          {/* Destination Marker */}
          <View style={styles.destMarker}>
            <View style={[styles.markerCircle, { backgroundColor: colors.error }]}>
              <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.markerText}>Airport T3</Text>
          </View>
        </View>

        {/* Available Vehicles Section Header */}
        <Text style={styles.sectionHeader}>AVAILABLE VEHICLES</Text>

        {/* Vehicles List */}
        {VEHICLES.map((vehicle, index) => {
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
                <MaterialIcons name={vehicle.icon} size={24} color={vehicle.tagColor} />
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
            style={styles.bookButton}
            onPress={() => navigation.navigate('ActiveRide', { rideId: 'RD-5021' })}
          >
            <Text style={styles.bookButtonText}>
              Book {selectedVehicle.name} • ₹{selectedVehicle.fare.toFixed(0)}
            </Text>
          </TouchableOpacity>
        </View>
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
  mapVisualizer: {
    height: 140,
    backgroundColor: '#161B2E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    position: 'relative',
    justifyContent: 'space-between',
  },
  pickupMarker: {
    position: 'absolute',
    top: 24,
    left: 36,
    alignItems: 'center',
  },
  destMarker: {
    position: 'absolute',
    bottom: 24,
    right: 48,
    alignItems: 'center',
  },
  markerCircle: {
    padding: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
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
