import { Injectable } from "@nestjs/common";
import { Fitter } from "../../../../domain/fitter";
import { FitterEntity } from "../entities/fitter.entity";

/**
 * Fitter Mapper
 *
 * Converts between domain entities and persistence entities.
 */
@Injectable()
export class FitterMapper {
  public toDomain(entity: FitterEntity): Fitter {
    return new Fitter(
      entity.id,
      entity.userId,
      entity.address,
      entity.zipcode,
      entity.state,
      entity.city,
      entity.country,
      entity.phoneNo,
      entity.cellNo,
      entity.currency,
      entity.emailaddress,
      entity.deleted,
    );
  }

  public toEntity(domain: Fitter): FitterEntity {
    const entity = new FitterEntity();
    if (domain.id) {
      entity.id = domain.id;
    }
    entity.userId = domain.userId;
    entity.address = domain.address;
    entity.zipcode = domain.zipcode;
    entity.state = domain.state;
    entity.city = domain.city;
    entity.country = domain.country;
    entity.phoneNo = domain.phoneNo;
    entity.cellNo = domain.cellNo;
    entity.currency = domain.currency;
    entity.emailaddress = domain.emailaddress;
    entity.deleted = domain.deleted;
    return entity;
  }

  public updateEntity(entity: FitterEntity, domain: Fitter): FitterEntity {
    entity.userId = domain.userId;
    entity.address = domain.address;
    entity.zipcode = domain.zipcode;
    entity.state = domain.state;
    entity.city = domain.city;
    entity.country = domain.country;
    entity.phoneNo = domain.phoneNo;
    entity.cellNo = domain.cellNo;
    entity.currency = domain.currency;
    entity.emailaddress = domain.emailaddress;
    entity.deleted = domain.deleted;
    return entity;
  }

  public toDomainArray(entities: FitterEntity[]): Fitter[] {
    return entities.map((entity) => this.toDomain(entity));
  }
}
