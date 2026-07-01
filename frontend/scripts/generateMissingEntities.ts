import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(__dirname, '../data');
const ORDERS_FILE = path.join(dataDir, 'ordersData.json');
const CUSTOMERS_FILE = path.join(dataDir, 'customersData.json');
const FITTERS_FILE = path.join(dataDir, 'fittersData.json');
const SUPPLIERS_FILE = path.join(dataDir, 'suppliersData.json');

interface EntityRef {
  id?: string | number;
  '@id'?: string;
  '$ref'?: string;
}

interface HydraDocument {
  'hydra:member'?: unknown[];
  [key: string]: unknown;
}

interface EntityMember {
  id?: string | number;
  [key: string]: unknown;
}

interface Order {
  customer?: EntityRef | string;
  fitter?: EntityRef | string;
  supplier?: EntityRef | string;
  [key: string]: unknown;
}

function extractIdFromRef(ref: string, type: 'customers' | 'fitters' | 'suppliers') {
  const match = ref.match(new RegExp(`/${type}/([\\w-]+)$`));
  return match ? match[1] : ref;
}

function collectReferencedIds(orders: Order[]) {
  const customerIds = new Set<string>();
  const fitterIds = new Set<string>();
  const supplierIds = new Set<string>();

  function addFitterRefs(fitter: EntityRef | string | undefined) {
    if (!fitter) return;
    if (typeof fitter === 'object') {
      if (fitter.id) fitterIds.add(String(fitter.id));
      if (fitter['@id']) fitterIds.add(extractIdFromRef(fitter['@id'], 'fitters'));
      if (fitter['$ref']) fitterIds.add(extractIdFromRef(fitter['$ref'], 'fitters'));
    } else if (typeof fitter === 'string') {
      fitterIds.add(extractIdFromRef(fitter, 'fitters'));
    }
  }

  function addCustomerRefs(customer: EntityRef | string | undefined) {
    if (!customer) return;
    if (typeof customer === 'object') {
      if (customer.id) customerIds.add(String(customer.id));
      if (customer['@id']) customerIds.add(extractIdFromRef(customer['@id'], 'customers'));
      if (customer['$ref']) customerIds.add(extractIdFromRef(customer['$ref'], 'customers'));
    } else if (typeof customer === 'string') {
      customerIds.add(extractIdFromRef(customer, 'customers'));
    }
  }

  function addSupplierRefs(supplier: EntityRef | string | undefined) {
    if (!supplier) return;
    if (typeof supplier === 'object') {
      if (supplier.id) supplierIds.add(String(supplier.id));
      if (supplier['@id']) supplierIds.add(extractIdFromRef(supplier['@id'], 'suppliers'));
      if (supplier['$ref']) supplierIds.add(extractIdFromRef(supplier['$ref'], 'suppliers'));
    } else if (typeof supplier === 'string') {
      supplierIds.add(extractIdFromRef(supplier, 'suppliers'));
    }
  }

  for (const order of orders) {
    addCustomerRefs(order.customer);
    addFitterRefs(order.fitter);
    addSupplierRefs(order.supplier);
  }
  return { customerIds, fitterIds, supplierIds };
}

function loadEntities(file: string): { hydra: { member: EntityMember[] }, raw: HydraDocument } {
  const raw: HydraDocument = JSON.parse(fs.readFileSync(file, 'utf8'));
  const member = (raw['hydra:member'] || []) as EntityMember[];
  return { hydra: { member }, raw };
}

function saveEntities(file: string, entities: EntityMember[], raw: HydraDocument) {
  raw['hydra:member'] = entities;
  fs.writeFileSync(file, JSON.stringify(raw, null, 2));
}

function createCustomer(id: string) {
  return {
    '@id': `/customers/${id}`,
    '@type': 'Customer',
    id,
    name: `Generated Customer ${id}`,
    email: null,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    address: null,
    city: null,
    zipcode: '',
    state: null,
    cellNo: '',
    phoneNo: '',
    country: null,
    typeName: 'Customer',
    createdBy: null,
    updatedBy: null,
    type: 'Customer',
    deleted: false
  };
}

function createFitter(id: string) {
  return {
    '@id': `/fitters/${id}`,
    '@type': 'Fitter',
    id,
    name: `Generated Fitter ${id}`,
    username: '',
    enabled: true,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    email: '',
    address: '',
    city: '',
    zipcode: '',
    state: null,
    cellNo: '',
    phoneNo: '',
    country: null,
    currency: '',
    typeName: 'Fitter',
    createdBy: null,
    updatedBy: null,
    type: 'Fitter',
    deleted: false
  };
}

function createSupplier(id: string) {
  return {
    '@id': `/suppliers/${id}`,
    '@type': 'Supplier',
    id,
    name: `Generated Supplier ${id}`,
    username: '',
    enabled: true,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    email: '',
    address: '',
    city: '',
    zipcode: '',
    state: null,
    cellNo: '',
    phoneNo: '',
    country: null,
    currency: '',
    typeName: 'Supplier',
    createdBy: null,
    updatedBy: null,
    type: 'Supplier',
    deleted: false
  };
}

function main() {
  const ordersRaw: HydraDocument = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const orders = (ordersRaw['hydra:member'] || []) as Order[];
  const { customerIds, fitterIds, supplierIds } = collectReferencedIds(orders);

  // Customers
  const { hydra: customersHydra, raw: customersRaw } = loadEntities(CUSTOMERS_FILE);
  const existingCustomerIds = new Set(customersHydra.member.map((c: EntityMember) => c.id));

  // Fitters
  const { hydra: fittersHydra, raw: fittersRaw } = loadEntities(FITTERS_FILE);
  const existingFitterIds = new Set(fittersHydra.member.map((f: EntityMember) => f.id));

  // Print debug info
  console.log('--- Referenced Fitter IDs ---');
  console.log(Array.from(fitterIds));
  console.log('--- Existing Fitter IDs ---');
  console.log(Array.from(existingFitterIds));

  // Suppliers
  const { hydra: suppliersHydra, raw: suppliersRaw } = loadEntities(SUPPLIERS_FILE);
  const existingSupplierIds = new Set(suppliersHydra.member.map((s: EntityMember) => s.id));

  let addedCustomers = 0;
  for (const id of customerIds) {
    if (!existingCustomerIds.has(id)) {
      customersHydra.member.push(createCustomer(id));
      addedCustomers++;
    }
  }
  saveEntities(CUSTOMERS_FILE, customersHydra.member, customersRaw);
  console.log(`Added ${addedCustomers} customers.`);

  let addedFitters = 0;
  for (const id of fitterIds) {
    if (!existingFitterIds.has(id)) {
      fittersHydra.member.push(createFitter(id));
      addedFitters++;
    }
  }
  saveEntities(FITTERS_FILE, fittersHydra.member, fittersRaw);
  console.log(`Added ${addedFitters} fitters.`);

  let addedSuppliers = 0;
  for (const id of supplierIds) {
    if (!existingSupplierIds.has(id)) {
      suppliersHydra.member.push(createSupplier(id));
      addedSuppliers++;
    }
  }
  saveEntities(SUPPLIERS_FILE, suppliersHydra.member, suppliersRaw);
  console.log(`Added ${addedSuppliers} suppliers.`);
}

main();
