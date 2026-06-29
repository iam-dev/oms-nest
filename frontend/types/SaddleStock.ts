export interface SaddleStock {
  id: number;
  serial: string;
  name: string;
  stock: number;
  stockOwner?: {
    id: string;
    name?: string;
    [key: string]: unknown;
  };
  model: string | { name?: string; [key: string]: unknown };
  leatherType?: string | { name?: string; [key: string]: unknown };
  preset?: string;
  demo: boolean;
  customizableProduct: boolean;
  productHasBeenOrdered: boolean;
  sponsored: boolean;
  createdAt: string;
  optionItems?: Array<{
    name: string;
    value: string | number;
  }>;
  [key: string]: unknown;
}

export interface SaddleStockSearchResult {
  data: SaddleStock[];
  total: number;
  pages: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}