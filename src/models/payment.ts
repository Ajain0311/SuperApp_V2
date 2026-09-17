export type PaymentModule = 'FOOD' | 'RIDE' | 'MARKETPLACE' | 'TEST';

export type PaymentCheckoutMode = 'mock' | 'easebuzz' | 'razorpay';

export interface PaymentKitInfo {
  configuredProvider: string;
  activeProvider: string;
  checkoutMode: PaymentCheckoutMode;
  keyId?: string | null;
  hasCredentials: boolean;
  checkoutUrl: string;
  testCards: string[];
}

export interface CreatePaymentOrderRequest {
  amount: number;
  currency?: string;
  receiptId?: string;
  module: PaymentModule;
}

export interface PaymentOrderResult {
  success: boolean;
  orderId: string;
  transactionId: string;
  amount: number;
  currency: string;
  keyId?: string | null;
  accessKey?: string | null;
  payUrl?: string | null;
  env?: string | null;
  errorMessage?: string | null;
}

export interface VerifyPaymentRequest {
  transactionId: string;
  orderId: string;
  paymentSignature: string;
}

export interface PaymentVerificationResult {
  isVerified: boolean;
  transactionId: string;
  status: string;
  message?: string | null;
}

export interface MockCompletePaymentRequest {
  transactionId: string;
  success: boolean;
}

export interface PaymentResult {
  isSuccess: boolean;
  transactionId: string;
  method: string;
  amount: number;
  orderId?: string;
  status?: string;
  errorMessage?: string;
}
