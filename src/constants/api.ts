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
    foods: '/restaurants/foods',
    restaurantDetail: (id: string | number) => `/restaurants/${id}`,
    orders: '/foodorders',
    checkout: '/foodorders/checkout',
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
    openChat: (id: string | number) => '/marketplace/listings/' + id + '/chat',
    conversation: (id: string | number) => '/marketplace/conversations/' + id,
    sendMessage: (id: string | number) => '/marketplace/conversations/' + id + '/messages',
    myConversations: '/marketplace/conversations',
    makeOffer: (id: string | number) => '/marketplace/listings/' + id + '/offer',
    listingOffers: (id: string | number) => '/marketplace/listings/' + id + '/offers',
    myOffers: '/marketplace/my-offers',
    updateOfferStatus: (id: string | number) => '/marketplace/offers/' + id + '/status',
  },

  // Common
  common: {
    config: '/config',
    support: '/config/support',
    addresses: '/addresses',
    address: (id: string | number) => `/addresses/${id}`,
    setDefaultAddress: (id: string | number) => `/addresses/${id}/default`,
    notifications: '/notifications',
    markNotificationRead: (id: string | number) => `/notifications/${id}/read`,
    markAllNotificationsRead: '/notifications/read-all',
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

  // Role applications (citizen → rider/hotel; admin approves)
  roleApplications: {
    submit: '/role-applications',
    mine: '/role-applications/mine',
    cancel: (id: string | number) => `/role-applications/${id}/cancel`,
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
    foodItems: '/admin/food-items',
    settings: '/admin/settings',
    broadcastNotification: '/admin/notifications/broadcast',
    roleApplications: '/admin/role-applications',
    approveRoleApplication: (id: string | number) => `/admin/role-applications/${id}/approve`,
    rejectRoleApplication: (id: string | number) => `/admin/role-applications/${id}/reject`,
  },

  // SignalR Hub Paths
  hubs: {
    ride: '/hubs/ride',
    order: '/hubs/order',
    chat: '/hubs/chat',
  },
} as const;
