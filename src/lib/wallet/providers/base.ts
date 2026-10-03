/**
 * BasePaymentProvider — capability-gated defaults for the contract.
 *
 * Adapters extend this class and override ONLY the operations they
 * support. Every default implementation first requires the matching
 * capability, so calling an unsupported operation fails with a typed
 * `capability_not_supported` error BEFORE any I/O — the wallet's
 * graceful-rejection rule lives here, not in each adapter.
 *
 * If an adapter DECLARES a capability but forgets to override the
 * method, the default still throws (now as `provider_error`), which
 * the shared contract test suite catches in CI.
 */

import { ProviderError } from "./types";
import type {
  PaymentProvider,
  ProviderBalanceInput,
  ProviderBalanceResult,
  ProviderCancelInput,
  ProviderCapability,
  ProviderConfirmDepositInput,
  ProviderCreateDepositInput,
  ProviderCreateWithdrawalInput,
  ProviderInfo,
  ProviderOperationResult,
  ProviderRefundInput,
  ProviderStatusInput,
  ProviderStatusResult,
  ProviderVerificationResult,
  ProviderWebhookInput,
  ProviderWebhookResult,
} from "./types";

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract getProviderInfo(): ProviderInfo;

  /** Does the adapter DECLARE this capability? */
  supports(capability: ProviderCapability): boolean {
    return this.getProviderInfo().capabilities.includes(capability);
  }

  /** Typed graceful rejection for undeclared capabilities. */
  requireCapability(capability: ProviderCapability): void {
    if (!this.supports(capability)) {
      throw new ProviderError(
        "capability_not_supported",
        `Provider "${this.getProviderInfo().id}" does not support ${capability}`,
      );
    }
  }

  /** Declared but not overridden — a bug the contract tests catch. */
  protected notImplemented(operation: string): never {
    throw new ProviderError(
      "provider_error",
      `Provider "${this.getProviderInfo().id}" declares support for ${operation} but it is not implemented`,
      { retryable: false },
    );
  }

  /**
   * Adapter-side availability. Defaults to available — the registry
   * layer still gates on configuration (enabled flag, environment…);
   * adapters with credentials override this to report misconfiguration.
   */
  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    return { available: true };
  }

  async getAccountBalance(
    _input: ProviderBalanceInput,
  ): Promise<ProviderBalanceResult> {
    void _input;
    this.requireCapability("BALANCE_CHECK");
    this.notImplemented("BALANCE_CHECK");
  }

  async createDeposit(
    _input: ProviderCreateDepositInput,
  ): Promise<ProviderOperationResult> {
    void _input;
    this.requireCapability("DEPOSIT");
    this.notImplemented("DEPOSIT");
  }

  async confirmDeposit(
    _input: ProviderConfirmDepositInput,
  ): Promise<ProviderOperationResult> {
    void _input;
    this.requireCapability("DEPOSIT");
    this.notImplemented("DEPOSIT (confirm)");
  }

  async createWithdrawal(
    _input: ProviderCreateWithdrawalInput,
  ): Promise<ProviderOperationResult> {
    void _input;
    this.requireCapability("WITHDRAWAL");
    this.notImplemented("WITHDRAWAL");
  }

  async cancelWithdrawal(
    _input: ProviderCancelInput,
  ): Promise<ProviderOperationResult> {
    void _input;
    this.requireCapability("WITHDRAWAL");
    this.notImplemented("WITHDRAWAL (cancel)");
  }

  async getTransactionStatus(
    _input: ProviderStatusInput,
  ): Promise<ProviderStatusResult> {
    void _input;
    this.requireCapability("TRANSACTION_STATUS");
    this.notImplemented("TRANSACTION_STATUS");
  }

  async verifyTransaction(
    _input: ProviderStatusInput,
  ): Promise<ProviderVerificationResult> {
    void _input;
    this.requireCapability("TRANSACTION_STATUS");
    this.notImplemented("TRANSACTION_STATUS (verify)");
  }

  async handleWebhook(
    _input: ProviderWebhookInput,
  ): Promise<ProviderWebhookResult> {
    void _input;
    this.requireCapability("WEBHOOK");
    this.notImplemented("WEBHOOK");
  }

  async refundTransaction(
    _input: ProviderRefundInput,
  ): Promise<ProviderOperationResult> {
    void _input;
    this.requireCapability("REFUND");
    this.notImplemented("REFUND");
  }
}
