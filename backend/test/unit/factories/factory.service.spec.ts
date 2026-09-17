import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../../../src/mail/mail.service";
import { FactoryService } from "../../../src/factories/factory.service";
import { FactoryEntity } from "../../../src/factories/infrastructure/persistence/relational/entities/factory.entity";
import { Repository, DataSource } from "typeorm";

describe("FactoryService", () => {
  let service: FactoryService;
  let repository: jest.Mocked<Repository<FactoryEntity>>;
  let dataSource: { query: jest.Mock };
  let mailService: { welcomeFactory: jest.Mock };

  function createMockFactoryEntity(): FactoryEntity {
    return {
      id: 1,
      userId: 200,
      address: "456 Factory Rd",
      zipcode: "54321",
      state: "New York",
      city: "New York",
      country: "United States",
      phoneNo: "555-4321",
      cellNo: "555-8765",
      currency: 1,
      emailaddress: "factory@example.com",
      deleted: 0,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      deletedAt: null,
      get isActive() {
        return this.deleted === 0;
      },
      get fullAddress() {
        const parts = [
          this.address,
          this.city,
          this.state,
          this.zipcode,
          this.country,
        ].filter((part) => part && part.trim() !== "");
        return parts.join(", ");
      },
      get displayName() {
        return this.city ? `Factory in ${this.city}` : `Factory #${this.id}`;
      },
    };
  }

  const mockFactoryEntity = createMockFactoryEntity();

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
    getMany: jest.fn().mockResolvedValue([mockFactoryEntity]),
    getRawAndEntities: jest.fn().mockResolvedValue({
      entities: [mockFactoryEntity],
      raw: [
        {
          u_name: "Test Factory",
          u_username: "testfactory",
          u_enabled: true,
          u_last_login: null,
        },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactoryService,
        {
          provide: getRepositoryToken(FactoryEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MailService,
          useValue: {
            welcomeFactory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("mock-hash"),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-value"),
            getOrThrow: jest.fn().mockReturnValue("30m"),
          },
        },
      ],
    }).compile();

    service = module.get<FactoryService>(FactoryService);
    repository = module.get(getRepositoryToken(FactoryEntity));
    dataSource = module.get(DataSource);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new factory successfully", async () => {
      // Arrange
      const createDto = {
        userId: 200,
        address: "456 Factory Rd",
        city: "New York",
        country: "United States",
      };
      repository.create.mockReturnValue(mockFactoryEntity);
      repository.save.mockResolvedValue(mockFactoryEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      // Every column on the legacy `factories` table is NOT NULL, so omitted
      // fields must be written as "" / 1, never null.
      expect(repository.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        address: createDto.address,
        zipcode: "",
        state: "",
        city: createDto.city,
        country: createDto.country,
        phoneNo: "",
        cellNo: "",
        currency: 1,
        emailaddress: "",
        deleted: 0,
      });
      expect(repository.save).toHaveBeenCalledWith(mockFactoryEntity);
      expect(result.id).toBe(1);
      expect(result.city).toBe("New York");
    });

    it("should create factory with all fields", async () => {
      // Arrange
      const createDto = {
        userId: 200,
        address: "456 Factory Rd",
        zipcode: "54321",
        state: "New York",
        city: "New York",
        country: "United States",
        phoneNo: "555-4321",
        cellNo: "555-8765",
        currency: 1,
        emailaddress: "factory@example.com",
      };
      repository.create.mockReturnValue(mockFactoryEntity);
      repository.save.mockResolvedValue(mockFactoryEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.save).toHaveBeenCalled();
      expect(result.emailaddress).toBe("factory@example.com");
    });

    describe("with a new login account", () => {
      /**
       * Route dataSource.query by SQL so one mock can answer the username
       * check, the credentials INSERT and the user-uuid lookup independently.
       */
      function mockCredentialQueries(
        opts: {
          existing?: boolean;
          userUuid?: string | null;
        } = {},
      ) {
        dataSource.query.mockImplementation((sql: string) => {
          if (/SELECT user_id FROM credentials WHERE user_name/i.test(sql)) {
            return Promise.resolve(opts.existing ? [{ user_id: 9 }] : []);
          }
          if (/INSERT INTO credentials/i.test(sql)) {
            return Promise.resolve([{ user_id: 501 }]);
          }
          if (/SELECT id FROM "user" WHERE legacy_id/i.test(sql)) {
            return Promise.resolve(
              opts.userUuid === null ? [] : [{ id: opts.userUuid ?? "uuid-1" }],
            );
          }
          if (/FROM "user" WHERE legacy_id = ANY/i.test(sql)) {
            return Promise.resolve([
              {
                legacy_id: 501,
                name: "Aiken USA",
                username: "aikenusa",
                enabled: true,
                last_login: 0,
              },
            ]);
          }
          return Promise.resolve([]);
        });
      }

      const createDto = {
        username: "aikenusa",
        name: "Aiken USA",
        address: "127 Main St",
        city: "Aiken",
        country: "United States",
        emailaddress: "cary@mysaddle.com",
      };

      it("should insert a factory-type credentials row and link the factory to it", async () => {
        mockCredentialQueries();
        repository.create.mockReturnValue(mockFactoryEntity);
        repository.save.mockResolvedValue({
          ...mockFactoryEntity,
          userId: 501,
        } as any);

        await service.create(createDto);

        const insertCall = dataSource.query.mock.calls.find(([sql]) =>
          /INSERT INTO credentials/i.test(sql),
        );
        expect(insertCall).toBeDefined();
        const [, params] = insertCall!;
        // [deleted, user_type, user_name, full_name, password_hash, ...]
        expect(params[1]).toBe(3); // user_type 3 = factory
        expect(params[2]).toBe("aikenusa");
        expect(params[3]).toBe("Aiken USA");
        expect(params[4]).toMatch(/^\$2[aby]\$/); // bcrypt hash, never plaintext
        expect(params[6]).toBe(0); // blocked = 0
        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 501, currency: 1 }),
        );
      });

      it("should fall back to the username as full_name when no name is given", async () => {
        mockCredentialQueries();
        repository.create.mockReturnValue(mockFactoryEntity);
        repository.save.mockResolvedValue(mockFactoryEntity);

        await service.create({ ...createDto, name: undefined });

        const [, params] = dataSource.query.mock.calls.find(([sql]) =>
          /INSERT INTO credentials/i.test(sql),
        )!;
        expect(params[3]).toBe("aikenusa");
      });

      it("should reject a username that is already taken", async () => {
        mockCredentialQueries({ existing: true });

        await expect(service.create(createDto)).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.create(createDto)).rejects.toThrow(
          "Username already exists",
        );
        expect(repository.save).not.toHaveBeenCalled();
      });

      it("should reject a create without username or userId (user_id is NOT NULL)", async () => {
        await expect(
          service.create({ address: "x", city: "y" }),
        ).rejects.toThrow(BadRequestException);
        expect(repository.save).not.toHaveBeenCalled();
      });

      it("should send the welcome / set-password email to the factory address", async () => {
        mockCredentialQueries({ userUuid: "uuid-501" });
        repository.create.mockReturnValue(mockFactoryEntity);
        repository.save.mockResolvedValue({
          ...mockFactoryEntity,
          userId: 501,
        } as any);

        await service.create(createDto);

        expect(mailService.welcomeFactory).toHaveBeenCalledWith({
          to: "cary@mysaddle.com",
          data: { hash: "mock-hash", tokenExpires: expect.any(Number) },
        });
      });

      it("should still create the factory when the welcome email fails", async () => {
        mockCredentialQueries();
        mailService.welcomeFactory.mockRejectedValue(new Error("smtp down"));
        repository.create.mockReturnValue(mockFactoryEntity);
        repository.save.mockResolvedValue({
          ...mockFactoryEntity,
          userId: 501,
        } as any);

        const result = await service.create(createDto);

        expect(result.id).toBe(1);
      });

      it("should return the linked user's name/username/enabled on the created dto", async () => {
        mockCredentialQueries();
        repository.create.mockReturnValue(mockFactoryEntity);
        repository.save.mockResolvedValue({
          ...mockFactoryEntity,
          userId: 501,
        } as any);

        const result = await service.create(createDto);

        expect(result.name).toBe("Aiken USA");
        expect(result.username).toBe("aikenusa");
        expect(result.enabled).toBe(true);
        expect(result.displayName).toBe("Aiken USA");
      });
    });
  });

  describe("findOne", () => {
    it("should find a factory by id with user relation", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockFactoryEntity);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deleted: 0 },
      });
      expect(result.id).toBe(1);
    });

    it("should attach name/username/enabled/lastLogin from the linked user", async () => {
      repository.findOne.mockResolvedValue(mockFactoryEntity);
      dataSource.query.mockResolvedValue([
        {
          legacy_id: 200,
          name: "Aiken USA",
          username: "aikenusa",
          enabled: true,
          last_login: 1528271289,
        },
      ]);

      const result = await service.findOne(1);

      expect(result.name).toBe("Aiken USA");
      expect(result.username).toBe("aikenusa");
      expect(result.enabled).toBe(true);
      expect(result.displayName).toBe("Aiken USA");
    });

    it("should throw NotFoundException when factory not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow("Factory not found");
    });
  });

  describe("findAll", () => {
    it("should find all factories with pagination and user relation", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(repository.createQueryBuilder).toHaveBeenCalledWith("factory");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "factory.deleted = 0",
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "factory.city",
        "ASC",
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.pages).toBe(1);
    });

    it("should filter by city", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findAll(1, 10, "New York");

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "factory.city ILIKE :city",
        { city: "%New York%" },
      );
      expect(result.data).toHaveLength(1);
    });

    it("should filter by country", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findAll(1, 10, undefined, "United States");

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "factory.country ILIKE :country",
        { country: "%United States%" },
      );
      expect(result.data).toHaveLength(1);
    });

    it("should filter by both city and country", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findAll(1, 10, "New York", "United States");

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(30);
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findAll(3, 10);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pages).toBe(3);
    });
  });

  describe("update", () => {
    it("should update a factory successfully", async () => {
      // Arrange
      const updateDto = {
        city: "Buffalo",
        state: "New York",
      };
      const updatedFactory = {
        ...mockFactoryEntity,
        ...updateDto,
      } as any;
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(updatedFactory);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.city).toBe("Buffalo");
    });

    it("should update only provided fields", async () => {
      // Arrange
      const updateDto = { phoneNo: "555-1111" };
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue({
        ...mockFactoryEntity,
        phoneNo: "555-1111",
      } as any);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result.phoneNo).toBe("555-1111");
      expect(result.city).toBe("New York");
    });

    it("should throw NotFoundException when factory not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, { city: "Boston" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should write name to credentials.full_name of the linked user", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);

      await service.update(1, { name: "Aiken USA Ltd" });

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE credentials SET full_name/i),
        ["Aiken USA Ltd", 200],
      );
    });

    it("should not blank credentials.full_name when name is empty", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);

      await service.update(1, { name: "   " });

      expect(dataSource.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE credentials SET full_name/i),
        expect.anything(),
      );
    });

    it("should set credentials.blocked = 1 when enabled is false", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);

      await service.update(1, { enabled: false });

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE credentials SET blocked/i),
        [1, 200],
      );
    });

    it("should set credentials.blocked = 0 when enabled is true", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);

      await service.update(1, { enabled: true });

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE credentials SET blocked/i),
        [0, 200],
      );
    });

    it("should not touch credentials.blocked when enabled is omitted", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);

      await service.update(1, { city: "Boston" });

      expect(dataSource.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE credentials SET blocked/i),
        expect.anything(),
      );
    });

    it("should return the updated factory with linked user data attached", async () => {
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue(mockFactoryEntity);
      dataSource.query.mockImplementation((sql: string) =>
        Promise.resolve(
          /FROM "user" WHERE legacy_id = ANY/i.test(sql)
            ? [
                {
                  legacy_id: 200,
                  name: "Aiken USA",
                  username: "aikenusa",
                  enabled: false,
                  last_login: 1528271289,
                },
              ]
            : [],
        ),
      );

      const result = await service.update(1, { city: "Aiken" });

      expect(result.name).toBe("Aiken USA");
      expect(result.username).toBe("aikenusa");
      expect(result.enabled).toBe(false);
      expect(result.lastLogin).toBe(1528271289);
    });
  });

  describe("remove", () => {
    it("should soft delete a factory", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(createMockFactoryEntity());
      repository.save.mockResolvedValue({
        ...mockFactoryEntity,
        deleted: 1,
      } as any);

      // Act
      await service.remove(1);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when factory not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByUserId", () => {
    it("should find factory by user id with user relation", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockFactoryEntity);

      // Act
      const result = await service.findByUserId(200);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: 200, deleted: 0 },
      });
      expect(result).toBeDefined();
      expect(result!.userId).toBe(200);
    });

    it("should return null when factory not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByUserId(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findActiveFactories", () => {
    it("should find all active factories with user relation", async () => {
      // Arrange
      repository.find.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findActiveFactories();

      // Assert
      expect(repository.find).toHaveBeenCalledWith({
        where: { deleted: 0 },
        order: { city: "ASC" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it("should return empty array when no active factories", async () => {
      // Arrange
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findActiveFactories();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByCountry", () => {
    it("should find factories by country with user relation", async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findByCountry("United States");

      // Assert
      expect(repository.createQueryBuilder).toHaveBeenCalledWith("factory");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "factory.deleted = 0",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "factory.country ILIKE :country",
        { country: "%United States%" },
      );
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no factories in country", async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await service.findByCountry("Canada");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByCity", () => {
    it("should find factories by city with user relation", async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([mockFactoryEntity]);

      // Act
      const result = await service.findByCity("New York");

      // Assert
      expect(repository.createQueryBuilder).toHaveBeenCalledWith("factory");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "factory.deleted = 0",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "factory.city ILIKE :city",
        { city: "%New York%" },
      );
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no factories in city", async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await service.findByCity("Boston");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getCountByCountry", () => {
    it("should return count of factories by country", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(8);

      // Act
      const result = await service.getCountByCountry("United States");

      // Assert
      expect(repository.createQueryBuilder).toHaveBeenCalledWith("factory");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "factory.deleted = 0",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "factory.country ILIKE :country",
        { country: "%United States%" },
      );
      expect(result).toBe(8);
    });

    it("should return 0 when no factories in country", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(0);

      // Act
      const result = await service.getCountByCountry("Canada");

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("getActiveCount", () => {
    it("should return count of active factories", async () => {
      // Arrange
      repository.count.mockResolvedValue(15);

      // Act
      const result = await service.getActiveCount();

      // Assert
      expect(repository.count).toHaveBeenCalledWith({
        where: { deleted: 0 },
      });
      expect(result).toBe(15);
    });

    it("should return 0 when no active factories", async () => {
      // Arrange
      repository.count.mockResolvedValue(0);

      // Act
      const result = await service.getActiveCount();

      // Assert
      expect(result).toBe(0);
    });
  });
});
