import { randomUUID } from "crypto";

export class ExtraId {
  constructor(private readonly _id: string) {
    if (!this.isValidUuid(_id)) {
      throw new Error("Invalid extra ID format");
    }
  }

  public static generate(): ExtraId {
    return new ExtraId(randomUUID());
  }

  public static fromString(id: string): ExtraId {
    return new ExtraId(id);
  }

  public get value(): string {
    return this._id;
  }

  public equals(other: ExtraId): boolean {
    return this._id === other._id;
  }

  public toString(): string {
    return this._id;
  }

  private isValidUuid(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
