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

  // SignalR Hub Paths
  hubs: {
    ride: '/hubs/ride',
    order: '/hubs/order',
    chat: '/hubs/chat',
  },
} as const;
