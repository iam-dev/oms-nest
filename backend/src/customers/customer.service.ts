import { Injectable, NotFoundException } from "@nestjs/common";
import { ICustomerRepository } from "./domain/customer.repository";
import { Customer } from "./domain/customer";
import { CustomerId } from "./domain/value-objects/customer-id.value-object";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

import { CustomerDto } from "./dto/customer.dto";
import { CustomerMapper as DtoMapper } from "./mappers/customer-dto.mapper";

/**
 * Customer Application Service
 *
 * Orchestrates customer domain operations and coordinates with external systems.
 * Based on PostgreSQL schema with address and contact information.
 */
@Injectable()
export class CustomerService {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly dtoMapper: DtoMapper,
  ) {}

  /**
   * Create a new customer
   */
  async create(createCustomerDto: CreateCustomerDto): Promise<CustomerDto> {
    const customerId = CustomerId.generate();
    const customer = Customer.create(
      customerId,
      createCustomerDto.name,
      createCustomerDto.email,
      createCustomerDto.horseName,
      createCustomerDto.company,
      createCustomerDto.address,
      createCustomerDto.city,
      createCustomerDto.state,
      createCustomerDto.zipcode,
      createCustomerDto.country,
      createCustomerDto.phoneNo,
      createCustomerDto.cellNo,
      createCustomerDto.bankAccountNumber,
      createCustomerDto.fitterId,
    );

    await this.customerRepository.save(customer);

    return this.dtoMapper.toDto(customer);
  }

  /**
   * Find customer by ID
   */
  async findOne(id: string): Promise<CustomerDto> {
    const customerId = CustomerId.fromString(id);
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.dtoMapper.toDto(customer);
  }

  /**
   * Find all customers with filtering and pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 30,
    name?: string,
    email?: string,
    city?: string,
    country?: string,
    fitterId?: number,
    search?: string,
    id?: number,
    orderFitterId?: number,
  ): Promise<{ data: CustomerDto[]; total: number; pages: number }> {
    const { customers, total } = await this.customerRepository.findAllPaginated(
      {
        page,
        limit,
        fitterId,
        orderFitterId,
        name,
        email,
        country,
        city,
        search,
        id,
      },
    );

    return {
      data: customers.map((customer) => this.dtoMapper.toDto(customer)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update customer
   */
  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    const customerId = CustomerId.fromString(id);
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Update contact information
    customer.updateContactInfo(
      updateCustomerDto.name,
      updateCustomerDto.email,
      updateCustomerDto.horseName,
      updateCustomerDto.company,
      updateCustomerDto.address,
      updateCustomerDto.city,
      updateCustomerDto.state,
      updateCustomerDto.zipcode,
      updateCustomerDto.country,
      updateCustomerDto.phoneNo,
      updateCustomerDto.cellNo,
      updateCustomerDto.bankAccountNumber,
    );

    // Update fitter if provided
    if (updateCustomerDto.fitterId !== undefined) {
      if (updateCustomerDto.fitterId !== null) {
        customer.assignFitter(updateCustomerDto.fitterId);
      } else {
        customer.removeFitter();
      }
    }

    await this.customerRepository.save(customer);

    return this.dtoMapper.toDto(customer);
  }

  /**
   * Remove customer (soft delete)
   */
  async remove(id: string): Promise<void> {
    const customerId = CustomerId.fromString(id);
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    await this.customerRepository.delete(customerId);
  }

  /**
   * Assign fitter to customer
   */
  async assignFitter(
    customerId: string,
    fitterId: number,
  ): Promise<CustomerDto> {
    const customer = await this.customerRepository.findById(
      CustomerId.fromString(customerId),
    );

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    customer.assignFitter(fitterId);
    await this.customerRepository.save(customer);

    return this.dtoMapper.toDto(customer);
  }

  /**
   * Find customers by fitter
   */
  async findByFitter(fitterId: number): Promise<CustomerDto[]> {
    const customers = await this.customerRepository.findByFitterId(fitterId);
    return customers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Find customers without fitter assigned
   */
  async findWithoutFitter(): Promise<CustomerDto[]> {
    const customers =
      await this.customerRepository.findActiveCustomersWithoutFitter();
    return customers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Find customers by country
   */
  async findByCountry(country: string): Promise<CustomerDto[]> {
    const customers = await this.customerRepository.findByCountry(country);
    return customers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Find customers by city
   */
  async findByCity(city: string): Promise<CustomerDto[]> {
    const customers = await this.customerRepository.findByCity(city);
    return customers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Get customer count by fitter
   */
  async getCustomerCountByFitter(fitterId: number): Promise<number> {
    return this.customerRepository.countByFitterId(fitterId);
  }

  /**
   * Get active customer count
   */
  async getActiveCount(): Promise<number> {
    return this.customerRepository.countActive();
  }

  /**
   * Find active customers
   */
  async findActive(): Promise<CustomerDto[]> {
    const customers = await this.customerRepository.findActive();
    return customers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Bulk create customers (for migration support)
   */
  async bulkCreate(customersData: CreateCustomerDto[]): Promise<CustomerDto[]> {
    const customers: Customer[] = [];

    for (const customerData of customersData) {
      const customerId = CustomerId.generate();

      const customer = Customer.create(
        customerId,
        customerData.name,
        customerData.email,
        customerData.horseName,
        customerData.company,
        customerData.address,
        customerData.city,
        customerData.state,
        customerData.zipcode,
        customerData.country,
        customerData.phoneNo,
        customerData.cellNo,
        customerData.bankAccountNumber,
        customerData.fitterId,
      );
      customers.push(customer);
    }

    const savedCustomers = await this.customerRepository.bulkCreate(customers);
    return savedCustomers.map((customer) => this.dtoMapper.toDto(customer));
  }

  /**
   * Validate data integrity for a customer
   */
  async validateDataIntegrity(customerId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const customer = await this.customerRepository.findById(
      CustomerId.fromString(customerId),
    );

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const issues: string[] = [];

    if (!customer.name || customer.name.trim().length === 0) {
      issues.push("Missing customer name");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
