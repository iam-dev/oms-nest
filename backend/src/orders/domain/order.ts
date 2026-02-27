import { OrderId } from "./value-objects/order-id.value-object";
import { OrderStatus } from "./value-objects/order-status.value-object";
import { OrderPriority } from "./value-objects/order-priority.value-object";

/**
 * Order Domain Entity
 *
 * Represents a saddle manufacturing order in the system.
 * Contains business logic for order management, status transitions, and validation.
 */
export class Order {
  private _domainEvents: any[] = [];

  constructor(
    private readonly _id: OrderId,
    private readonly _customerId: number,
    private _orderNumber: string,
    private _status: OrderStatus,
    private _priority: OrderPriority,
    private _fitterId: number | null,
    private _factoryId: number | null,
    private _saddleSpecifications: Record<string, any>,
    private _specialInstructions: string | null,
    private _estimatedDeliveryDate: Date | null,
    private _actualDeliveryDate: Date | null,
    private _totalAmount: number,
    private _depositPaid: number,
    private _balanceOwing: number,
    private _measurements: Record<string, any> | null,
    private _isUrgent: boolean = false,
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date(),
    private _seatSizes: string[] | null = null,
    private _customerName: string | null = null,
    private _saddleId: number | null = null,
  ) {
    this.validateBusinessRules();
  }

  /**
   * Factory method to create a new order
   */
  public static create(
    id: OrderId,
    customerId: number,
    orderNumber: string,
    saddleSpecifications: Record<string, any>,
    totalAmount: number,
    specialInstructions?: string,
    estimatedDeliveryDate?: Date,
  ): Order {
    const order = new Order(
      id,
      customerId,
      orderNumber,
      OrderStatus.PENDING,
      OrderPriority.NORMAL,
      null,
      null,
      saddleSpecifications,
      specialInstructions || null,
      estimatedDeliveryDate || null,
      null,
      totalAmount,
      0, // No deposit paid initially
      totalAmount, // Full balance owing
      null, // No measurements yet
      false,
    );

    // TODO: Domain event for order created
    return order;
  }

  /**
   * Assign order to a fitter
   */
  public assignFitter(fitterId: number): void {
    if (this._status.isFinal()) {
      throw new Error("Cannot assign fitter to completed order");
    }

    if (!fitterId || fitterId <= 0) {
      throw new Error("Valid fitter ID is required");
    }

    this._fitterId = fitterId;
    this._updatedAt = new Date();

    // TODO: Domain event for fitter assigned
  }

  /**
   * Assign order to a factory
   */
  public assignFactory(factoryId: number): void {
    if (this._status.isFinal()) {
      throw new Error("Cannot assign factory to completed order");
    }

    if (!factoryId || factoryId <= 0) {
      throw new Error("Valid factory ID is required");
    }

    this._factoryId = factoryId;
    this._updatedAt = new Date();

    // TODO: Domain event for factory assigned
  }

  /**
   * Change order status with validation
   */
  public changeStatus(newStatus: OrderStatus, _reason?: string): void {
    void _reason;
    if (!this._status.canTransitionTo(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this._status.toString()} to ${newStatus.toString()}`,
      );
    }

    const _oldStatus = this._status;
    void _oldStatus;
    this._status = newStatus;
    this._updatedAt = new Date();

    // Set actual delivery date when delivered
    if (newStatus.equals(OrderStatus.DELIVERED) && !this._actualDeliveryDate) {
      this._actualDeliveryDate = new Date();
    }

    // TODO: Domain event for status changed
  }

  /**
   * Update order priority
   */
  public updatePriority(newPriority: OrderPriority, _reason?: string): void {
    void _reason;
    if (this._status.isFinal()) {
      throw new Error("Cannot change priority of completed order");
    }

    const _oldPriority = this._priority;
    void _oldPriority;
    this._priority = newPriority;
    this._isUrgent = newPriority.isUrgent();
    this._updatedAt = new Date();

    // TODO: Domain event for priority changed
  }

  /**
   * Record deposit payment
   */
  public recordDepositPayment(amount: number): void {
    if (amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }

    if (this._depositPaid + amount > this._totalAmount) {
      throw new Error("Deposit amount exceeds total order value");
    }

    this._depositPaid += amount;
    this._balanceOwing = this._totalAmount - this._depositPaid;
    this._updatedAt = new Date();

    // TODO: Domain event for payment recorded
  }

  /**
   * Update saddle measurements
   */
  public updateMeasurements(measurements: Record<string, any>): void {
    if (this._status.isFinal()) {
      throw new Error("Cannot update measurements for completed order");
    }

    this._measurements = { ...measurements };
    this._updatedAt = new Date();

    // TODO: Domain event for measurements updated
  }

  /**
   * Update estimated delivery date
   */
  public updateEstimatedDeliveryDate(date: Date): void {
    if (this._status.isFinal()) {
      throw new Error("Cannot update delivery date for completed order");
    }

    if (date <= new Date()) {
      throw new Error("Estimated delivery date must be in the future");
    }

    this._estimatedDeliveryDate = date;
    this._updatedAt = new Date();

    // TODO: Domain event for delivery date updated
  }

  /**
   * Cancel the order
   */
  public cancel(reason: string): void {
    if (!this._status.canBeCancelled()) {
      throw new Error(
        `Order cannot be cancelled in ${this._status.toString()} status`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error("Cancellation reason is required");
    }

    this._status = OrderStatus.CANCELLED;
    this._updatedAt = new Date();

    // TODO: Domain event for order cancelled
  }

  /**
   * Check if order is overdue
   */
  public isOverdue(): boolean {
    if (!this._estimatedDeliveryDate || this._status.isFinal()) {
      return false;
    }

    return new Date() > this._estimatedDeliveryDate;
  }

  /**
   * Calculate days until delivery
   */
  public getDaysUntilDelivery(): number | null {
    if (!this._estimatedDeliveryDate || this._status.isFinal()) {
      return null;
    }

    const now = new Date();
    const diffTime = this._estimatedDeliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if deposit is required
   */
  public requiresDeposit(): boolean {
    return this._depositPaid < this._totalAmount * 0.3; // 30% deposit required
  }

  /**
   * Get payment percentage completed
   */
  public getPaymentPercentage(): number {
    return this._totalAmount > 0
      ? (this._depositPaid / this._totalAmount) * 100
      : 0;
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(): void {
    if (!this._customerId) {
      throw new Error("Customer ID is required");
    }

    if (!this._orderNumber || this._orderNumber.trim().length === 0) {
      throw new Error("Order number is required");
    }

    if (this._totalAmount <= 0) {
      throw new Error("Total amount must be positive");
    }

    if (this._depositPaid < 0) {
      throw new Error("Deposit cannot be negative");
    }

    if (this._balanceOwing < 0) {
      throw new Error("Balance owing cannot be negative");
    }
  }

  // Getters
  public get id(): OrderId {
    return this._id;
  }

  public get customerId(): number {
    return this._customerId;
  }

  public get orderNumber(): string {
    return this._orderNumber;
  }

  public get status(): OrderStatus {
    return this._status;
  }

  public get priority(): OrderPriority {
    return this._priority;
  }

  public get fitterId(): number | null {
    return this._fitterId;
  }

  public get factoryId(): number | null {
    return this._factoryId;
  }

  public get saddleSpecifications(): Record<string, any> {
    return { ...this._saddleSpecifications };
  }

  public get specialInstructions(): string | null {
    return this._specialInstructions;
  }

  public get estimatedDeliveryDate(): Date | null {
    return this._estimatedDeliveryDate;
  }

  public get actualDeliveryDate(): Date | null {
    return this._actualDeliveryDate;
  }

  public get totalAmount(): number {
    return this._totalAmount;
  }

  public get depositPaid(): number {
    return this._depositPaid;
  }

  public get balanceOwing(): number {
    return this._balanceOwing;
  }

  public get measurements(): Record<string, any> | null {
    return this._measurements ? { ...this._measurements } : null;
  }

  public get isUrgent(): boolean {
    return this._isUrgent;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get seatSizes(): string[] | null {
    return this._seatSizes;
  }

  public get customerName(): string | null {
    return this._customerName;
  }

  public get saddleId(): number | null {
    return this._saddleId;
  }

  public updateSeatSizes(seatSizes: string[]): void {
    this._seatSizes = seatSizes;
    this._updatedAt = new Date();
  }

  /**
   * Update customer name (for search optimization)
   */
  public updateCustomerName(customerName: string): void {
    this._customerName = customerName;
    this._updatedAt = new Date();
  }

  /**
   * Update saddle ID (for type-based filtering)
   */
  public updateSaddleId(saddleId: number): void {
    this._saddleId = saddleId;
    this._updatedAt = new Date();
  }

  /**
   * Get uncommitted domain events (for CQRS integration)
   */
  public getUncommittedEvents(): any[] {
    return this._domainEvents.slice();
  }

  /**
   * Mark all domain events as committed
   */
  public markEventsAsCommitted(): void {
    this._domainEvents = [];
  }
}
