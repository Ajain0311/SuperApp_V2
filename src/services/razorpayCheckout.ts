import { Platform } from 'react-native';
import { PaymentOrderResult } from '../models/payment';

export interface RazorpayCheckoutSuccessResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Web Checkout is only supported in web runtime'));
  }
  if ((window as any).Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay checkout script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout.js'));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  order: PaymentOrderResult,
  userDetails?: { name?: string; email?: string; contact?: string }
): Promise<RazorpayCheckoutSuccessResult> {
  if (Platform.OS !== 'web' && typeof window === 'undefined') {
    throw new Error('Please open SuperApp Web or use web browser for standard web checkout.');
  }

  const key = order.keyId || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
  if (!key) {
    throw new Error('Razorpay Key ID is missing.');
  }

  if (!order.orderId) {
    throw new Error('Razorpay Order ID is missing.');
  }

  await loadRazorpayScript();
  const Razorpay = (window as any).Razorpay;
  if (!Razorpay) {
    throw new Error('Razorpay SDK failed to initialize');
  }

  return new Promise((resolve, reject) => {
    const amountInPaise = Math.round(order.amount * 100);

    const options: any = {
      key,
      amount: amountInPaise,
      currency: order.currency || 'INR',
      name: 'RJ09 SEWA',
      description: 'Order Payment',
      order_id: order.orderId,
      prefill: {
        name: userDetails?.name || '',
        email: userDetails?.email || '',
        contact: userDetails?.contact || '',
      },
      theme: {
        color: '#FF6B35',
      },
      handler: function (response: any) {
        if (response && response.razorpay_payment_id) {
          resolve({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || order.orderId,
            razorpay_signature: response.razorpay_signature || '',
          });
        } else {
          reject(new Error('Razorpay payment response missing payment_id'));
        }
      },
      modal: {
        ondismiss: function () {
          reject(new Error('Payment modal closed by user'));
        },
      },
    };

    const rzp = new Razorpay(options);

    rzp.on('payment.failed', function (response: any) {
      const desc = response?.error?.description || response?.error?.reason || 'Payment failed';
      reject(new Error(`Razorpay payment failed: ${desc}`));
    });

    rzp.open();
  });
}
