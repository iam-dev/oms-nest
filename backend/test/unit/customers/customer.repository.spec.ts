import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CustomerRepository } from "../../../src/customers/infrastructure/persistence/relational/repositories/customer.repository";
import { CustomerEntity } from "../../../src/customers/infrastructure/persistence/relational/entities/customer.entity";
import { CustomerMapper } from "../../../src/customers/infrastructure/persistence/relational/mappers/customer.mapper";

/**
 * Regression coverage for the fitter scope in findAllPaginated.
 *
 * A fitter searching for a customer from Edit Order > Select Customer must be
 * able to find (a) customers assigned to them via customers.fitter_id and
 * (b) customers who have an order with them. Scoping on (b) alone means a
 * newly created customer can never be put on their first order.
 */
describe("CustomerRepository.findAllPaginated", () => {
  let repository: CustomerRepository;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerRepository,
        {
          provide: getRepositoryToken(CustomerEntity),
          useValue: { createQueryBuilder: jest.fn(() => mockQueryBuilder) },
        },
        {
          provide: CustomerMapper,
          useValue: { toDomainArray: jest.fn(() => []) },
        },
      ],
    }).compile();

    repository = module.get(CustomerRepository);
  });

  it("should scope a fitter to customers they own OR have an order with", async () => {
    await repository.findAllPaginated({
      page: 1,
      limit: 10,
      search: "smith",
      scopedFitterId: 312,
    });

    const scopeCall = mockQueryBuilder.andWhere.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes(":scopedFitterId"),
    );
    expect(scopeCall).toBeDefined();
    const [sql, params] = scopeCall as [string, Record<string, unknown>];

    // Both halves of the scope, OR-ed together inside one parenthesised predicate
    expect(sql).toMatch(/^\(.*\)$/);
    expect(sql).toContain("customer.fitter_id = :scopedFitterId");
    expect(sql).toMatch(/\sOR\s/);
    expect(sql).toContain(
      "customer.id IN (SELECT DISTINCT customer_id FROM orders WHERE fitter_id = :scopedFitterId AND deleted_at IS NULL)",
    );
    expect(params).toEqual({ scopedFitterId: 312 });
  });

  it("should not add a fitter scope for unscoped (admin) callers", async () => {
    await repository.findAllPaginated({ page: 1, limit: 10, search: "smith" });

    const scoped = mockQueryBuilder.andWhere.mock.calls.some(
      ([sql]) => typeof sql === "string" && sql.includes("fitter_id"),
    );
    expect(scoped).toBe(false);
  });
});
