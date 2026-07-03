export interface ProductSaddle {
  id: number;
  serial: string;
  name: string;
  specialNotes?: string;
  stock: number;
  model: string | { name?: string; [key: string]: unknown };
  preset?: string;
  leatherType: string | { name?: string; [key: string]: unknown };
  demo: boolean;
  customizableProduct: boolean;
  productHasBeenOrdered: boolean;
  sponsored: boolean;
  createdAt: string;
  optionItems?: OptionItem[];
  [key: string]: unknown;
}

export interface OptionItem {
  name: string;
  value: string | number;
}