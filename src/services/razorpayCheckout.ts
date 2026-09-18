import { Platform } from 'react-native';
import { PaymentOrderResult } from '../models/payment';

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (resp: any) => void) => void;
};

function getRazorpayCtor(): RazorpayCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Razorpay ?? null;
}

export function loadRazorpayScript(): Promise<RazorpayCtor> {
  if (Platform.OS !== 'web') {
    return Promise.reject(new Error('Razorpay Checkout is only wired for web in this test kit.'));
  }

  const existing = getRazorpayCtor();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const ctor = getRazorpayCtor();
      if (ctor) resolve(ctor);
      else reject(new Error('Razorpay script loaded but Razorpay is missing'));
    };
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.body.appendChild(script);
  });
}

export function openRazorpayCheckout(
  order: PaymentOrderResult,
  prefillName?: string
): Promise<RazorpayCheckoutSuccess> {
  return new Promise(async (resolve, reject) => {
    try {
      const Razorpay = await loadRazorpayScript();
      const key = order.keyId;
      if (!key || !key.startsWith('rzp_')) {
        reject(new Error('Razorpay test key missing on order'));
        return;
      }

      const rzp = new Razorpay({
        key,
        amount: Math.round(order.amount * 100),
        currency: order.currency || 'INR',
        name: 'SuperApp Test',
        description: 'Test payment kit',
        order_id: order.orderId,
        prefill: { name: prefillName || 'Test User' },
        theme: { color: '#FF6B35' },
        handler: (response: RazorpayCheckoutSuccess) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Checkout closed without paying')),
        },
      });

      rzp.on('payment.failed', (resp: any) => {
        reject(new Error(resp?.error?.description || 'Payment failed'));
      });

      rzp.open();
    } catch (err: any) {
      reject(err);
    }
  });
}

export function isRazorpayKey(key?: string | null): boolean {
  return Boolean(key && key.startsWith('rzp_') && !key.includes('mock'));
}
