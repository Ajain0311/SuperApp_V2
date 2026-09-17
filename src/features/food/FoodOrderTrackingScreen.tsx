import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../../theme/colors';
import { AppRadius } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';

interface FoodOrderTrackingScreenProps {
  route: {
    params: {
      orderId?: string;
    };
  };
  navigation: any;
}

export const FoodOrderTrackingScreen: React.FC<FoodOrderTrackingScreenProps> = ({
  route,
  navigation,
}) => {
  const orderId = route.params?.orderId || 'FO-1002';

  const steps = [
    {
      title: 'Order Received',
      subtitle: 'Restaurant confirmed your order',
      isCompleted: true,
      isCurrent: false,
    },
    {
      title: 'Kitchen Preparing',
      subtitle: 'Chef is cooking your fresh dishes',
      isCompleted: true,
      isCurrent: true,
    },
    {
      title: 'Ready for Pickup',
      subtitle: 'Delivery partner arrives at restaurant',
      isCompleted: false,
      isCurrent: false,
    },
    {
      title: 'Out for Delivery',
      subtitle: 'Heading to Connaught Place',
      isCompleted: false,
      isCurrent: false,
    },
    {
      title: 'Delivered',
      subtitle: 'Enjoy your meal!',
      isCompleted: false,
      isCurrent: false,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainShell')}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Track Order {orderId}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ETA Card */}
        <LinearGradient
          colors={['#EA580C', '#C2410C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.etaCard}
        >
          <View style={styles.etaIconCircle}>
            <Ionicons name="bicycle" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.etaTextCol}>
            <Text style={styles.etaCaption}>Estimated Delivery</Text>
            <Text style={styles.etaMainText}>22 Mins • On Time</Text>
            <Text style={styles.etaSubText}>Meghana Foods is preparing your feast</Text>
          </View>
        </LinearGradient>

        {/* Order Progress Stepper */}
        <View style={styles.progressCard}>
          <Text style={styles.cardHeaderTitle}>Order Progress</Text>

          <View style={styles.stepperContainer}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              const iconColor = step.isCurrent
                ? AppColors.primary
                : step.isCompleted
                ? AppColors.secondary
                : AppColors.textTertiary;

              return (
                <View key={idx}>
                  <View style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepIconCircle,
                        {
                          borderColor: iconColor,
                          backgroundColor: `${iconColor}33`,
                        },
                      ]}
                    >
                      {step.isCompleted ? (
                        <Ionicons name="checkmark" size={13} color={iconColor} />
                      ) : (
                        <View style={[styles.innerDot, { backgroundColor: iconColor }]} />
                      )}
                    </View>

                    <View style={styles.stepTextCol}>
                      <Text
                        style={[
                          styles.stepTitle,
                          {
                            color:
                              step.isCurrent || step.isCompleted
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                            fontWeight: step.isCurrent ? '800' : '600',
                          },
                        ]}
                      >
                        {step.title}
                      </Text>
                      <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                    </View>
                  </View>

                  {!isLast && (
                    <View
                      style={[
                        styles.stepConnector,
                        {
                          backgroundColor: step.isCompleted
                            ? AppColors.secondary
                            : AppColors.border,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Delivery Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={26} color={AppColors.secondary} />
          </View>

          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>Ramesh Kumar</Text>
            <Text style={styles.driverRole}>Delivery Partner • 4.9 ★ (840 trips)</Text>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Alert.alert('Calling Partner', 'Connecting to Ramesh Kumar (+91 98765 00012)...')}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={20} color={AppColors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Return Button */}
        <AppButton
          text="Return to SuperApp Home"
          onPressed={() => navigation.navigate('MainShell')}
          style={styles.returnButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  etaIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  etaTextCol: {
    flex: 1,
  },
  etaCaption: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  etaMainText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  etaSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  progressCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 20,
    marginBottom: 18,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 16,
  },
  stepperContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
  },
  stepSubtitle: {
    fontSize: 12,
    color: AppColors.textTertiary,
    marginTop: 2,
  },
  stepConnector: {
    width: 2,
    height: 22,
    marginLeft: 11,
    marginVertical: 4,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    marginBottom: 24,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${AppColors.secondary}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  driverRole: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceLight,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnButton: {
    marginBottom: 20,
  },
});
