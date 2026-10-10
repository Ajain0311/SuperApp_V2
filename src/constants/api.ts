export const ApiEndpoints = {
  // Auth
  auth: {
    sendOtp: '/auth/send-otp',
    verifyOtp: '/auth/verify-otp',
    adminLogin: '/auth/admin-login',
    profile: '/auth/profile',
  },

  // Food
  food: {
    restaurants: '/restaurants',
    restaurantDetail: (id: string | number) => `/restaurants/${id}`,
    orders: '/foodorders',
    orderDetail: (id: string | number) => `/foodorders/${id}`,
    payOrder: (id: string | number) => `/foodorders/${id}/pay`,
    cancelOrder: (id: string | number) => `/foodorders/${id}/cancel`,
    validateCoupon: '/coupons/validate',
  },

  // Ride
  ride: {
    estimate: '/rides/estimate',
    book: '/rides/book',
    detail: (id: string | number) => `/rides/${id}`,
    myRides: '/rides',
    start: (id: string | number) => `/rides/${id}/start`,
    complete: (id: string | number) => `/rides/${id}/complete`,
    cancel: (id: string | number) => `/rides/${id}/cancel`,
    rate: (id: string | number) => `/rides/${id}/rate`,
  },

  // Marketplace
  marketplace: {
    categories: '/marketplace/categories',
    listings: '/marketplace',
    listingDetail: (id: string | number) => `/marketplace/${id}`,
    manageListings: '/marketplace/listings', // Action API: ADD, EDIT, DELETE, STATUS
    myListings: '/marketplace/my-listings',
    toggleFavorite: (id: string | number) => `/marketplace/favorites/${id}`,
    favorites: '/marketplace/favorites',
  },

  // Common
  common: {
    addresses: '/addresses',
    address: (id: string | number) => `/addresses/${id}`,
    setDefaultAddress: (id: string | number) => `/addresses/${id}/default`,
    notifications: '/notifications',
    markNotificationRead: (id: string | number) => `/notifications/${id}/read`,
    banners: '/banners',
    reviews: '/reviews',
    paymentsKit: '/payments/kit',
    paymentsCreate: '/payments/create-order',
    paymentsVerify: '/payments/verify',
    paymentsMockComplete: '/payments/mock-complete',
    paymentsMine: '/payments/my-payments',
  },

  // Driver Mode
  driver: {
    profile: '/driver/profile',
    toggleOnline: '/driver/toggle-online',
    availableRides: '/driver/available-rides',
    activeRide: '/driver/active-ride',
    acceptRide: (id: string | number) => `/driver/rides/${id}/accept`,
    arriving: (id: string | number) => `/driver/rides/${id}/arriving`,
    startRide: (id: string | number) => `/driver/rides/${id}/start`,
    completeRide: (id: string | number) => `/driver/rides/${id}/complete`,
    cancelRide: (id: string | number) => `/driver/rides/${id}/cancel`,
    updateLocation: '/driver/location',
    history: '/driver/history',
    earnings: '/driver/earnings',
    availableFood: '/driver/available-food-orders',
    activeFood: '/driver/active-food-order',
    acceptFood: (id: string | number) => `/driver/food-orders/${id}/accept`,
    unassignFood: (id: string | number) => `/driver/food-orders/${id}/unassign`,
    pickupFood: (id: string | number) => `/driver/food-orders/${id}/pickup`,
    deliverFood: (id: string | number) => `/driver/food-orders/${id}/deliver`,
  },

  // Vendor Mode (Restaurant Owner)
  vendor: {
    myRestaurant: '/vendor/my-restaurant',
    dashboard: '/vendor/dashboard',
    toggleStatus: '/vendor/toggle-status',
    menu: '/vendor/menu',
    orders: '/vendor/orders',
    updateOrderStatus: (id: string | number) => `/vendor/orders/${id}/status`,
    manageFoodItems: '/vendor/food-items',
    earnings: '/vendor/earnings',
  },

  // Admin Mode
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    assignRole: '/admin/users/assign',
    restaurants: '/admin/restaurants',
    foodOrders: '/admin/food-orders',
    rides: '/admin/rides',
    drivers: '/admin/drivers',
    marketplaceListings: '/admin/marketplace/listings',
    settings: '/admin/settings',
    broadcastNotification: '/admin/notifications/broadcast',
  },

  // SignalR Hub Paths
  hubs: {
    ride: '/hubs/ride',
    order: '/hubs/order',
    chat: '/hubs/chat',
  },
} as const;
