export interface SaddleStock {
  id: number;
  serial: string;
  name: string;
  stock: number;
  stockOwner?: {
    id: string;
    name?: string;
    [key: string]: any;
  };
  model: string | { name?: string; [key: string]: any };
  leatherType?: string | { name?: string; [key: string]: any };
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
  [key: string]: any;
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