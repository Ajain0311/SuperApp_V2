export interface PaymentResult {
  isSuccess: boolean;
  transactionId: string;
  method: string;
  amount: number;
  errorMessage?: string;
}

class PaymentService {
  /**
   * Process simulated in-app payment with instant feedback (matching Flutter PaymentService)
   */
  async processPayment(amount: number, method: string, module: string): Promise<PaymentResult> {
    // Simulate brief network latency
    await new Promise((resolve) => setTimeout(resolve, 650));

    const txnId = `TXN_${Date.now()}`;
    return {
      isSuccess: true,
      transactionId: txnId,
      method,
      amount,
    };
  }
}

export const paymentService = new PaymentService();
