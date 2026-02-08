/**
 * Fitter Domain Entity
 *
 * Represents a fitter in the saddle manufacturing system.
 * Uses integer IDs to match PostgreSQL legacy schema.
 * Soft delete via `deleted` column (smallint: 0 = active, 1 = deleted).
 */
export class Fitter {
  constructor(
    private readonly _id: number,
    private _userId: number | null,
    private _address: string | null,
    private _zipcode: string | null,
    private _state: string | null,
    private _city: string | null,
    private _country: string | null,
    private _phoneNo: string | null,
    private _cellNo: string | null,
    private _currency: number | null,
    private _emailaddress: string | null,
    private _deleted: number,
  ) {}

  public static create(
    id: number,
    userId?: number | null,
    address?: string | null,
    zipcode?: string | null,
    state?: string | null,
    city?: string | null,
    country?: string | null,
    phoneNo?: string | null,
    cellNo?: string | null,
    currency?: number | null,
    emailaddress?: string | null,
  ): Fitter {
    return new Fitter(
      id,
      userId ?? null,
      address ?? null,
      zipcode ?? null,
      state ?? null,
      city ?? null,
      country ?? null,
      phoneNo ?? null,
      cellNo ?? null,
      currency ?? null,
      emailaddress ?? null,
      0,
    );
  }

  public updateInfo(
    userId?: number | null,
    address?: string | null,
    zipcode?: string | null,
    state?: string | null,
    city?: string | null,
    country?: string | null,
    phoneNo?: string | null,
    cellNo?: string | null,
    currency?: number | null,
    emailaddress?: string | null,
  ): void {
    if (userId !== undefined) this._userId = userId;
    if (address !== undefined) this._address = address;
    if (zipcode !== undefined) this._zipcode = zipcode;
    if (state !== undefined) this._state = state;
    if (city !== undefined) this._city = city;
    if (country !== undefined) this._country = country;
    if (phoneNo !== undefined) this._phoneNo = phoneNo;
    if (cellNo !== undefined) this._cellNo = cellNo;
    if (currency !== undefined) this._currency = currency;
    if (emailaddress !== undefined) this._emailaddress = emailaddress;
  }

  public markDeleted(): void {
    this._deleted = 1;
  }

  public isActive(): boolean {
    return this._deleted === 0;
  }

  public getFullAddress(): string {
    const parts = [
      this._address,
      this._city,
      this._state,
      this._zipcode,
      this._country,
    ].filter((part) => part && part.trim() !== "");
    return parts.join(", ");
  }

  public getDisplayName(): string {
    return this._city ? `Fitter in ${this._city}` : `Fitter #${this._id}`;
  }

  // Getters
  public get id(): number {
    return this._id;
  }
  public get userId(): number | null {
    return this._userId;
  }
  public get address(): string | null {
    return this._address;
  }
  public get zipcode(): string | null {
    return this._zipcode;
  }
  public get state(): string | null {
    return this._state;
  }
  public get city(): string | null {
    return this._city;
  }
  public get country(): string | null {
    return this._country;
  }
  public get phoneNo(): string | null {
    return this._phoneNo;
  }
  public get cellNo(): string | null {
    return this._cellNo;
  }
  public get currency(): number | null {
    return this._currency;
  }
  public get emailaddress(): string | null {
    return this._emailaddress;
  }
  public get deleted(): number {
    return this._deleted;
  }
}
