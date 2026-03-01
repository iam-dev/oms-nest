import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CustomerController } from "../../../src/customers/customer.controller";
import { CustomerService } from "../../../src/customers/customer.service";
import { CreateCustomerDto } from "../../../src/customers/dto/create-customer.dto";
import { UpdateCustomerDto } from "../../../src/customers/dto/update-customer.dto";
import { CustomerDto } from "../../../src/customers/dto/customer.dto";
import { CustomerStatus } from "../../../src/customers/domain/value-objects/customer-status.value-object";

describe("CustomerController", () => {
  let controller: CustomerController;
  let customerService: jest.Mocked<CustomerService>;
  let mockDataSource: { query: jest.Mock };

  const mockCustomerDto: CustomerDto = {
    id: 1001,
    email: "customer@example.com",
    name: "John Doe",
    address: "123 Main Street",
    city: "New York",
    country: "USA",
    fitterId: 2001,
    status: CustomerStatus.ACTIVE,
    createdAt: new Date("2023-12-01"),
    updatedAt: new Date("2023-12-01"),
    displayName: "John Doe (customer@example.com)",
    isActive: true,
    hasFitter: true,
  };

  beforeEach(async () => {
    const mockCustomerService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assignFitter: jest.fn(),
      findByFitter: jest.fn(),
      findWithoutFitter: jest.fn(),
      getCustomerCountByFitter: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        { provide: CustomerService, useValue: mockCustomerService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<CustomerController>(CustomerController);
    customerService = module.get(CustomerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new customer successfully", async () => {
      // Arrange
      const createDto: CreateCustomerDto = {
        email: "customer@example.com",
        name: "John Doe",
        address: "123 Main Street",
        city: "New York",
        country: "USA",
        fitterId: 2001,
      };
      customerService.create.mockResolvedValue(mockCustomerDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockCustomerDto);
      expect(customerService.create).toHaveBeenCalledWith(createDto);
      expect(customerService.create).toHaveBeenCalledTimes(1);
    });

    it("should create customer with minimal required data", async () => {
      // Arrange
      const minimalCreateDto: CreateCustomerDto = {
        email: "minimal@example.com",
        name: "Jane Smith",
        address: "456 Oak Avenue",
        city: "Los Angeles",
        country: "USA",
      };
      const minimalCustomer = {
        ...mockCustomerDto,
        ...minimalCreateDto,
        fitterId: undefined,
      };
      customerService.create.mockResolvedValue(minimalCustomer);

      // Act
      const result = await controller.create(minimalCreateDto);

      // Assert
      expect(result).toEqual(minimalCustomer);
      expect(customerService.create).toHaveBeenCalledWith(minimalCreateDto);
    });

    it("should handle email conflict when creating customer", async () => {
      // Arrange
      const createDto: CreateCustomerDto = {
        email: "existing@example.com",
        name: "Duplicate User",
        address: "789 Conflict St",
        city: "Chicago",
        country: "USA",
        fitterId: 2001,
      };
      customerService.create.mockRejectedValue(
        new ConflictException(
          "Customer with this email already exists for this fitter",
        ),
      );

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(customerService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("findAll", () => {
    it("should return paginated customers with query filters", async () => {
      // Arrange
      const paginatedResponse = {
        data: [mockCustomerDto],
        total: 1,
        pages: 1,
      };
      customerService.findAll.mockResolvedValue(paginatedResponse);

      // Act
      const result = await controller.findAll(
        1,
        10,
        undefined,
        undefined,
        "John",
        "customer@example.com",
        "New York",
        "USA",
        2001,
      );

      // Assert
      expect(result).toEqual(paginatedResponse);
      expect(customerService.findAll).toHaveBeenCalledWith(
        1,
        10,
        "John",
        "customer@example.com",
        "New York",
        "USA",
        2001,
        undefined,
        undefined,
        undefined,
      );
      expect(customerService.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return all customers without filters", async () => {
      // Arrange
      const paginatedResponse = {
        data: [mockCustomerDto],
        total: 1,
        pages: 1,
      };
      customerService.findAll.mockResolvedValue(paginatedResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(paginatedResponse);
      expect(customerService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should handle empty customer list", async () => {
      // Arrange
      const emptyResponse = { data: [], total: 0, pages: 0 };
      customerService.findAll.mockResolvedValue(emptyResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(emptyResponse);
    });
  });

  describe("findOne", () => {
    it("should return customer by ID", async () => {
      // Arrange
      const customerId = 1001;
      customerService.findOne.mockResolvedValue(mockCustomerDto);

      // Act
      const result = await controller.findOne(customerId);

      // Assert
      expect(result).toEqual(mockCustomerDto);
      expect(customerService.findOne).toHaveBeenCalledWith(
        customerId.toString(),
      );
      expect(customerService.findOne).toHaveBeenCalledTimes(1);
    });

    it("should handle customer not found", async () => {
      // Arrange
      const customerId = 9999;
      customerService.findOne.mockRejectedValue(
        new NotFoundException("Customer not found"),
      );

      // Act & Assert
      await expect(controller.findOne(customerId)).rejects.toThrow(
        NotFoundException,
      );
      expect(customerService.findOne).toHaveBeenCalledWith(
        customerId.toString(),
      );
    });
  });

  describe("update", () => {
    it("should update customer successfully", async () => {
      // Arrange
      const customerId = 1001;
      const updateDto: UpdateCustomerDto = {
        name: "John Updated",
        email: "john.updated@example.com",
        address: "123 Updated Street",
        city: "Updated City",
        country: "Updated Country",
        fitterId: 3001,
        status: CustomerStatus.INACTIVE,
      };
      const updatedCustomer = { ...mockCustomerDto, ...updateDto };
      customerService.update.mockResolvedValue(updatedCustomer);

      // Act
      const result = await controller.update(customerId, updateDto);

      // Assert
      expect(result).toEqual(updatedCustomer);
      expect(customerService.update).toHaveBeenCalledWith(
        customerId.toString(),
        updateDto,
      );
      expect(customerService.update).toHaveBeenCalledTimes(1);
    });

    it("should update customer with partial data", async () => {
      // Arrange
      const customerId = 1001;
      const updateDto: UpdateCustomerDto = {
        name: "Partially Updated",
      };
      const partiallyUpdatedCustomer = {
        ...mockCustomerDto,
        name: "Partially Updated",
      };
      customerService.update.mockResolvedValue(partiallyUpdatedCustomer);

      // Act
      const result = await controller.update(customerId, updateDto);

      // Assert
      expect(result).toEqual(partiallyUpdatedCustomer);
      expect(customerService.update).toHaveBeenCalledWith(
        customerId.toString(),
        updateDto,
      );
    });

    it("should handle customer not found during update", async () => {
      // Arrange
      const customerId = 9999;
      const updateDto: UpdateCustomerDto = { name: "Not Found" };
      customerService.update.mockRejectedValue(
        new NotFoundException("Customer not found"),
      );

      // Act & Assert
      await expect(controller.update(customerId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(customerService.update).toHaveBeenCalledWith(
        customerId.toString(),
        updateDto,
      );
    });

    it("should handle email conflict during update", async () => {
      // Arrange
      const customerId = 1001;
      const updateDto: UpdateCustomerDto = {
        email: "existing@example.com",
      };
      customerService.update.mockRejectedValue(
        new ConflictException(
          "Customer with this email already exists for this fitter",
        ),
      );

      // Act & Assert
      await expect(controller.update(customerId, updateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(customerService.update).toHaveBeenCalledWith(
        customerId.toString(),
        updateDto,
      );
    });
  });

  describe("remove", () => {
    it("should remove customer successfully", async () => {
      // Arrange
      const customerId = 1001;
      customerService.remove.mockResolvedValue();

      // Act
      await controller.remove(customerId);

      // Assert
      expect(customerService.remove).toHaveBeenCalledWith(
        customerId.toString(),
      );
      expect(customerService.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle customer not found during removal", async () => {
      // Arrange
      const customerId = 9999;
      customerService.remove.mockRejectedValue(
        new NotFoundException("Customer not found"),
      );

      // Act & Assert
      await expect(controller.remove(customerId)).rejects.toThrow(
        NotFoundException,
      );
      expect(customerService.remove).toHaveBeenCalledWith(
        customerId.toString(),
      );
    });
  });

  describe("assignFitter", () => {
    it("should assign fitter to customer successfully", async () => {
      // Arrange
      const customerId = 1001;
      const fitterId = 3001;
      const customerWithNewFitter = { ...mockCustomerDto, fitterId };
      customerService.assignFitter.mockResolvedValue(customerWithNewFitter);

      // Act
      const result = await controller.assignFitter(customerId, fitterId);

      // Assert
      expect(result).toEqual(customerWithNewFitter);
      expect(customerService.assignFitter).toHaveBeenCalledWith(
        customerId.toString(),
        fitterId,
      );
      expect(customerService.assignFitter).toHaveBeenCalledTimes(1);
    });

    it("should handle customer not found during fitter assignment", async () => {
      // Arrange
      const customerId = 9999;
      const fitterId = 3001;
      customerService.assignFitter.mockRejectedValue(
        new NotFoundException("Customer not found"),
      );

      // Act & Assert
      await expect(
        controller.assignFitter(customerId, fitterId),
      ).rejects.toThrow(NotFoundException);
      expect(customerService.assignFitter).toHaveBeenCalledWith(
        customerId.toString(),
        fitterId,
      );
    });
  });

  describe("findByFitter", () => {
    it("should return customers by fitter ID", async () => {
      // Arrange
      const fitterId = 2001;
      const customers = [mockCustomerDto];
      customerService.findByFitter.mockResolvedValue(customers);

      // Act
      const result = await controller.findByFitter(fitterId);

      // Assert
      expect(result).toEqual(customers);
      expect(customerService.findByFitter).toHaveBeenCalledWith(fitterId);
      expect(customerService.findByFitter).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no customers for fitter", async () => {
      // Arrange
      const fitterId = 2001;
      customerService.findByFitter.mockResolvedValue([]);

      // Act
      const result = await controller.findByFitter(fitterId);

      // Assert
      expect(result).toEqual([]);
      expect(customerService.findByFitter).toHaveBeenCalledWith(fitterId);
    });
  });

  describe("findWithoutFitter", () => {
    it("should return customers without fitter", async () => {
      // Arrange
      const customerWithoutFitter = { ...mockCustomerDto, fitterId: undefined };
      const customersWithoutFitter = [customerWithoutFitter];
      customerService.findWithoutFitter.mockResolvedValue(
        customersWithoutFitter,
      );

      // Act
      const result = await controller.findWithoutFitter();

      // Assert
      expect(result).toEqual(customersWithoutFitter);
      expect(customerService.findWithoutFitter).toHaveBeenCalledWith();
      expect(customerService.findWithoutFitter).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when all customers have fitters", async () => {
      // Arrange
      customerService.findWithoutFitter.mockResolvedValue([]);

      // Act
      const result = await controller.findWithoutFitter();

      // Assert
      expect(result).toEqual([]);
      expect(customerService.findWithoutFitter).toHaveBeenCalledWith();
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle service throwing unexpected errors", async () => {
      // Arrange
      const customerId = 1001;
      customerService.findOne.mockRejectedValue(
        new Error("Database connection error"),
      );

      // Act & Assert
      await expect(controller.findOne(customerId)).rejects.toThrow(
        "Database connection error",
      );
      expect(customerService.findOne).toHaveBeenCalledWith(
        customerId.toString(),
      );
    });

    it("should handle null/undefined request parameters gracefully", async () => {
      // Arrange
      const emptyResponse = { data: [], total: 0, pages: 0 };
      customerService.findAll.mockResolvedValue(emptyResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(emptyResponse);
    });

    it("should handle empty update object", async () => {
      // Arrange
      const customerId = 1001;
      const emptyUpdateDto: UpdateCustomerDto = {};
      customerService.update.mockResolvedValue(mockCustomerDto);

      // Act
      const result = await controller.update(customerId, emptyUpdateDto);

      // Assert
      expect(result).toEqual(mockCustomerDto);
      expect(customerService.update).toHaveBeenCalledWith(
        customerId.toString(),
        emptyUpdateDto,
      );
    });

    it("should handle invalid ID format in parameters", async () => {
      // Arrange - Testing with a valid number that doesn't exist
      const invalidCustomerId = 0;
      customerService.findOne.mockRejectedValue(
        new NotFoundException("Customer not found"),
      );

      // Act & Assert
      await expect(controller.findOne(invalidCustomerId)).rejects.toThrow(
        NotFoundException,
      );
      expect(customerService.findOne).toHaveBeenCalledWith(
        invalidCustomerId.toString(),
      );
    });

    it("should handle multiple customers returned from single customer operations", async () => {
      // Arrange
      const customerId = 1001;
      customerService.findOne.mockResolvedValue(mockCustomerDto);

      // Act
      const result = await controller.findOne(customerId);

      // Assert
      expect(result).toEqual(mockCustomerDto);
      expect(customerService.findOne).toHaveBeenCalledWith(
        customerId.toString(),
      );
    });

    it("should handle large datasets gracefully", async () => {
      // Arrange
      const largeCustomerList = Array(1000)
        .fill(mockCustomerDto)
        .map((customer, index) => ({
          ...customer,
          id: customer.id + index,
          email: `customer${index}@example.com`,
        }));
      const paginatedResponse = {
        data: largeCustomerList,
        total: 1000,
        pages: 34,
      };
      customerService.findAll.mockResolvedValue(paginatedResponse);

      // Act
      const result = await controller.findAll(1, 30);

      // Assert
      expect(result.data).toHaveLength(1000);
      expect(result.total).toBe(1000);
    });
  });

  describe("fitter auto-filtering via orders", () => {
    it("should pass orderFitterId for fitter users", async () => {
      // Arrange
      const paginatedResponse = { data: [mockCustomerDto], total: 1, pages: 1 };
      customerService.findAll.mockResolvedValue(paginatedResponse);
      mockDataSource.query.mockResolvedValue([{ id: 312 }]);

      const fitterReq = {
        user: { legacyId: 448, role: { id: 1, name: "fitter" } },
      };

      // Act
      const result = await controller.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        fitterReq,
      );

      // Assert
      expect(result).toEqual(paginatedResponse);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        "SELECT id FROM fitters WHERE user_id = $1 LIMIT 1",
        [448],
      );
      expect(customerService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        312,
      );
    });

    it("should not pass orderFitterId for admin users", async () => {
      // Arrange
      const paginatedResponse = { data: [mockCustomerDto], total: 1, pages: 1 };
      customerService.findAll.mockResolvedValue(paginatedResponse);

      const adminReq = {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      };

      // Act
      await controller.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        adminReq,
      );

      // Assert
      expect(mockDataSource.query).not.toHaveBeenCalled();
      expect(customerService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should not override explicit fitterId query param for fitter users", async () => {
      // Arrange: fitter user passes explicit fitterId query param
      const paginatedResponse = { data: [mockCustomerDto], total: 1, pages: 1 };
      customerService.findAll.mockResolvedValue(paginatedResponse);
      mockDataSource.query.mockResolvedValue([{ id: 312 }]);

      const fitterReq = {
        user: { legacyId: 448, role: { id: 1, name: "fitter" } },
      };

      // Act: pass fitterId=999 as query param
      await controller.findAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        999,
        fitterReq,
      );

      // Assert: fitterId query param preserved, orderFitterId also set
      expect(customerService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        999,
        undefined,
        undefined,
        312,
      );
    });

    it("should handle fitter with no fitter record gracefully", async () => {
      // Arrange
      const paginatedResponse = { data: [], total: 0, pages: 0 };
      customerService.findAll.mockResolvedValue(paginatedResponse);
      mockDataSource.query.mockResolvedValue([]); // No fitter record

      const fitterReq = {
        user: { legacyId: 999, role: { id: 1, name: "fitter" } },
      };

      // Act
      await controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        fitterReq,
      );

      // Assert: orderFitterId should be undefined since no fitter record found
      expect(customerService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });
});
