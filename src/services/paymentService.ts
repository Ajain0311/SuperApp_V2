import { paymentApi } from './paymentApi';
import { openEasebuzzCheckout } from './easebuzzCheckout';
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

  usesEasebuzz(order: PaymentOrderResult, kit?: PaymentKitInfo): boolean {
    if (kit?.checkoutMode === 'easebuzz') return true;
    return Boolean(order.accessKey && order.keyId);
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
    module: PaymentModule
  ): Promise<PaymentResult> {
    const kit = await this.getKit().catch(() => undefined);
    const order = await this.createOrder(amount, module);

    if (this.usesEasebuzz(order, kit)) {
      const checkout = await openEasebuzzCheckout(order);
      const verified = await this.verify(checkout.txnid, order.orderId, checkout.hash);
      const ok = verified.isVerified || checkout.status === 'success';
      return {
        isSuccess: ok,
        transactionId: checkout.txnid,
        method: 'EASEBUZZ',
        amount,
        orderId: order.orderId,
        status: verified.status,
        errorMessage: ok ? undefined : verified.message || 'Payment not successful',
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
