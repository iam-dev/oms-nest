import { Injectable } from "@nestjs/common";
import { Extra } from "../../../../domain/extra";
import { ExtraEntity } from "../entities/extra.entity";
import { ExtraId } from "../../../../domain/value-objects/extra-id.value-object";

/**
 * Extra Mapper
 *
 * Converts between domain entities and persistence entities.
 */
@Injectable()
export class ExtraMapper {
  public toDomain(entity: ExtraEntity): Extra {
    return new Extra(
      ExtraId.fromString(entity.id),
      entity.name,
      entity.description ?? null,
      entity.price1,
      entity.price2,
      entity.price3,
      entity.price4,
      entity.price5,
      entity.price6,
      entity.price7,
      entity.sequence,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }

  public toEntity(domain: Extra): ExtraEntity {
    const entity = new ExtraEntity();
    entity.id = domain.id.value;
    entity.name = domain.name;
    entity.description = domain.description ?? undefined;
    entity.price1 = domain.price1;
    entity.price2 = domain.price2;
    entity.price3 = domain.price3;
    entity.price4 = domain.price4;
    entity.price5 = domain.price5;
    entity.price6 = domain.price6;
    entity.price7 = domain.price7;
    entity.sequence = domain.sequence;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.deletedAt = domain.deletedAt;
    return entity;
  }

  public updateEntity(entity: ExtraEntity, domain: Extra): ExtraEntity {
    entity.name = domain.name;
    entity.description = domain.description ?? undefined;
    entity.price1 = domain.price1;
    entity.price2 = domain.price2;
    entity.price3 = domain.price3;
    entity.price4 = domain.price4;
    entity.price5 = domain.price5;
    entity.price6 = domain.price6;
    entity.price7 = domain.price7;
    entity.sequence = domain.sequence;
    entity.updatedAt = domain.updatedAt;
    entity.deletedAt = domain.deletedAt;
    return entity;
  }

  public toDomainArray(entities: ExtraEntity[]): Extra[] {
    return entities.map((entity) => this.toDomain(entity));
  }
}
