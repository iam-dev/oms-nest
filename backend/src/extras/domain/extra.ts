import { ExtraId } from "./value-objects/extra-id.value-object";

/**
 * Extra Domain Entity
 *
 * Represents an extra (add-on) in the saddle manufacturing system.
 * Uses UUID IDs and 7-tier pricing (USD, EUR, GBP, CAD, AUD, NOK, DKK).
 * Soft delete via deletedAt timestamp.
 */
export class Extra {
  constructor(
    private readonly _id: ExtraId,
    private _name: string,
    private _description: string | null,
    private _price1: number,
    private _price2: number,
    private _price3: number,
    private _price4: number,
    private _price5: number,
    private _price6: number,
    private _price7: number,
    private _sequence: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  public static create(
    id: ExtraId,
    name: string,
    description?: string,
    price1: number = 0,
    price2: number = 0,
    price3: number = 0,
    price4: number = 0,
    price5: number = 0,
    price6: number = 0,
    price7: number = 0,
    sequence: number = 0,
  ): Extra {
    return new Extra(
      id,
      name,
      description ?? null,
      price1,
      price2,
      price3,
      price4,
      price5,
      price6,
      price7,
      sequence,
      new Date(),
      new Date(),
      null,
    );
  }

  public updateInfo(
    name?: string,
    description?: string,
    price1?: number,
    price2?: number,
    price3?: number,
    price4?: number,
    price5?: number,
    price6?: number,
    price7?: number,
    sequence?: number,
  ): void {
    if (name !== undefined) this._name = name;
    if (description !== undefined) this._description = description ?? null;
    if (price1 !== undefined) this._price1 = price1;
    if (price2 !== undefined) this._price2 = price2;
    if (price3 !== undefined) this._price3 = price3;
    if (price4 !== undefined) this._price4 = price4;
    if (price5 !== undefined) this._price5 = price5;
    if (price6 !== undefined) this._price6 = price6;
    if (price7 !== undefined) this._price7 = price7;
    if (sequence !== undefined) this._sequence = sequence;
    this._updatedAt = new Date();
  }

  public softDelete(): void {
    this._deletedAt = new Date();
    this._updatedAt = new Date();
  }

  public isActive(): boolean {
    return this._deletedAt === null;
  }

  // Getters
  public get id(): ExtraId {
    return this._id;
  }
  public get name(): string {
    return this._name;
  }
  public get description(): string | null {
    return this._description;
  }
  public get price1(): number {
    return this._price1;
  }
  public get price2(): number {
    return this._price2;
  }
  public get price3(): number {
    return this._price3;
  }
  public get price4(): number {
    return this._price4;
  }
  public get price5(): number {
    return this._price5;
  }
  public get price6(): number {
    return this._price6;
  }
  public get price7(): number {
    return this._price7;
  }
  public get sequence(): number {
    return this._sequence;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }
  public get updatedAt(): Date {
    return this._updatedAt;
  }
  public get deletedAt(): Date | null {
    return this._deletedAt;
  }
}
