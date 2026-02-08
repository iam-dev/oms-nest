import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FitterEntity } from "./entities/fitter.entity";
import { FitterRepository } from "./repositories/fitter.repository";
import { FitterMapper } from "./mappers/fitter.mapper";
import { IFitterRepository } from "../../../domain/fitter.repository";

@Module({
  imports: [TypeOrmModule.forFeature([FitterEntity])],
  providers: [
    FitterMapper,
    {
      provide: IFitterRepository,
      useClass: FitterRepository,
    },
  ],
  exports: [IFitterRepository, FitterMapper],
})
export class FitterRelationalPersistenceModule {}
