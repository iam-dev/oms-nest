import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExtraEntity } from "./entities/extra.entity";
import { ExtraRepository } from "./repositories/extra.repository";
import { ExtraMapper } from "./mappers/extra.mapper";
import { IExtraRepository } from "../../../domain/extra.repository";

@Module({
  imports: [TypeOrmModule.forFeature([ExtraEntity])],
  providers: [
    ExtraMapper,
    {
      provide: IExtraRepository,
      useClass: ExtraRepository,
    },
  ],
  exports: [IExtraRepository, ExtraMapper],
})
export class ExtraRelationalPersistenceModule {}
