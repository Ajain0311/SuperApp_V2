import { Platform } from 'react-native';
import { PaymentOrderResult } from '../models/payment';

export interface EasebuzzCheckoutResult {
  txnid: string;
  status: string;
  hash?: string;
  easepayid?: string;
}

function loadEasebuzzScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Easebuzz Checkout is web-only in this kit'));
  }
  if ((window as any).EasebuzzCheckout) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/easebuzz-checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Easebuzz Checkout script'));
    document.body.appendChild(script);
  });
}

export async function openEasebuzzCheckout(
  order: PaymentOrderResult
): Promise<EasebuzzCheckoutResult> {
  if (Platform.OS !== 'web') {
    throw new Error('Open the SuperApp web app to complete Easebuzz checkout');
  }

  const accessKey = order.accessKey;
  const key = order.keyId;
  const env = order.env === 'prod' ? 'prod' : 'test';

  if (!accessKey || !key) {
    throw new Error('Easebuzz access key missing from create-order');
  }

  try {
    await loadEasebuzzScript();
    const EasebuzzCheckout = (window as any).EasebuzzCheckout;
    if (EasebuzzCheckout) {
      return await new Promise((resolve, reject) => {
        const checkout = new EasebuzzCheckout(key, env);
        checkout.initiatePayment({
          access_key: accessKey,
          onResponse: (response: any) => {
            const status = String(response?.status || '').toLowerCase();
            const txnid = String(response?.txnid || order.transactionId);
            if (status === 'success') {
              resolve({
                txnid,
                status,
                hash: response?.hash,
                easepayid: response?.easepayid,
              });
            } else if (status === 'userCancelled' || status === 'dropped' || status === 'pending') {
              reject(new Error(response?.error || 'Payment was not completed'));
            } else {
              reject(new Error(response?.error || `Payment ${status || 'failed'}`));
            }
          },
          theme: '#FF6B35',
        });
      });
    }
  } catch {
    // Fall through to hosted pay page.
  }

  return openHostedPayPage(order);
}

function openHostedPayPage(order: PaymentOrderResult): Promise<EasebuzzCheckoutResult> {
  const url = order.payUrl;
  if (!url) {
    return Promise.reject(new Error('Easebuzz pay URL missing'));
  }

  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'easebuzz_pay', 'width=480,height=720');
    if (!popup) {
      window.location.href = url;
      reject(new Error('Popup blocked. Allow popups and retry, or complete payment in the opened tab.'));
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'easebuzz') return;
      window.removeEventListener('message', onMessage);
      const status = String(data.status || '').toLowerCase();
      if (status === 'success') {
        resolve({ txnid: data.txnid || order.transactionId, status });
      } else {
        reject(new Error(`Payment ${status || 'closed'}`));
      }
    };
    window.addEventListener('message', onMessage);

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        window.removeEventListener('message', onMessage);
        resolve({ txnid: order.transactionId, status: 'unknown' });
      }
    }, 800);
  });
}
