export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES ?? '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  },
  pricing: {
    freeListingsCount: parseInt(process.env.FREE_LISTINGS_COUNT ?? '3', 10),
    listingPriceSyp: parseInt(process.env.LISTING_PRICE_SYP ?? '10', 10),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    newListingsTopic: process.env.FCM_NEW_LISTINGS_TOPIC ?? 'new_listings',
  },
});
