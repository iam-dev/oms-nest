export interface OrderProductSaddle {
  id: number;
  orderId: number;
  legacyRepair: boolean;
  productSaddle?: {
    id: number;
    serial: string;
    name: string;
    model: string | { name?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  order?: {
    id: number;
    customer?: {
      id: number;
      name: string;
      [key: string]: unknown;
    };
    fitter?: {
      id: number;
      name: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
