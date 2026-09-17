import { apiClient } from './apiClient';
import { ApiEndpoints } from '../constants/api';
import {
  CreatePaymentOrderRequest,
  MockCompletePaymentRequest,
  PaymentKitInfo,
  PaymentOrderResult,
  PaymentVerificationResult,
  VerifyPaymentRequest,
} from '../models/payment';

interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

function unwrap<T>(payload: Envelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as Envelope<T>).data !== undefined) {
    return (payload as Envelope<T>).data as T;
  }
  return payload as T;
}

export const paymentApi = {
  async getKit(): Promise<PaymentKitInfo> {
    const res = await apiClient.get<Envelope<PaymentKitInfo>>(ApiEndpoints.common.paymentsKit);
    return unwrap(res);
  },

  async createOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrderResult> {
    const res = await apiClient.post<Envelope<PaymentOrderResult>>(ApiEndpoints.common.paymentsCreate, {
      amount: request.amount,
      currency: request.currency ?? 'INR',
      receiptId: request.receiptId ?? `rcpt_${Date.now()}`,
      module: request.module,
    });
    const data = unwrap(res);
    if (data && data.success === false) {
      throw new Error(data.errorMessage || 'Could not create payment order');
    }
    return data;
  },

  async verify(request: VerifyPaymentRequest): Promise<PaymentVerificationResult> {
    const res = await apiClient.post<Envelope<PaymentVerificationResult>>(
      ApiEndpoints.common.paymentsVerify,
      request
    );
    return unwrap(res);
  },

  async mockComplete(request: MockCompletePaymentRequest): Promise<PaymentVerificationResult> {
    const res = await apiClient.post<Envelope<PaymentVerificationResult>>(
      ApiEndpoints.common.paymentsMockComplete,
      request
    );
    return unwrap(res);
  },
};
