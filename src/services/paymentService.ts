import { paymentApi } from './paymentApi';
import { openRazorpayCheckout } from './razorpayCheckout';
import {
  PaymentKitInfo,
  PaymentModule,
  PaymentOrderResult,
  PaymentResult,
  PaymentVerificationResult,
} from '../models/payment';

class PaymentService {
  async getKit(): Promise<PaymentKitInfo> {
    return paymentApi.getKit();
  }

  async createOrder(amount: number, module: PaymentModule): Promise<PaymentOrderResult> {
    return paymentApi.createOrder({
      amount,
      currency: 'INR',
      module,
      receiptId: `rcpt_${module.toLowerCase()}_${Date.now()}`,
    });
  }

  usesRazorpay(order: PaymentOrderResult, kit?: PaymentKitInfo): boolean {
    if (kit?.checkoutMode === 'razorpay') return true;
    return Boolean(order.keyId && order.orderId);
  }

  async verify(
    transactionId: string,
    orderId?: string,
    signature?: string
  ): Promise<PaymentVerificationResult> {
    return paymentApi.verify({
      transactionId,
      orderId: orderId || transactionId,
      paymentSignature: signature || '',
    });
  }

  async completeMock(transactionId: string, success: boolean): Promise<PaymentVerificationResult> {
    return paymentApi.mockComplete({ transactionId, success });
  }

  async processPayment(
    amount: number,
    method: string,
    module: PaymentModule,
    userDetails?: { name?: string; email?: string; contact?: string }
  ): Promise<PaymentResult> {
    const kit = await this.getKit().catch(() => undefined);
    const order = await this.createOrder(amount, module);

    if (this.usesRazorpay(order, kit)) {
      const checkout = await openRazorpayCheckout(order, userDetails);
      const verified = await this.verify(
        checkout.razorpay_payment_id,
        checkout.razorpay_order_id,
        checkout.razorpay_signature
      );
      const ok = verified.isVerified === true;
      return {
        isSuccess: ok,
        transactionId: checkout.razorpay_payment_id,
        method: 'RAZORPAY',
        amount,
        orderId: checkout.razorpay_order_id,
        status: verified.status,
        errorMessage: ok ? undefined : verified.message || 'Payment verification failed',
      };
    }

    return {
      isSuccess: false,
      transactionId: order.transactionId,
      method,
      amount,
      orderId: order.orderId,
      status: 'PENDING',
      errorMessage: 'MOCK_CHECKOUT_REQUIRED',
    };
  }
}

export const paymentService = new PaymentService();
