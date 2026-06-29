// Comprehensive Order Detail API Service
// Based on the old Breeze UI implementation for complete order editing
import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';
import type {
  ComprehensiveOrderData,
  Customer,
  Fitter,
  ProductSaddle,
} from '@/types/ComprehensiveOrder';

/**
 * Fetch comprehensive order data for editing
 * This replicates the multiple API calls made by the old Breeze UI
 */
export async function fetchComprehensiveOrderData(orderId: number): Promise<ComprehensiveOrderData> {
  logger.log('Fetching comprehensive order data for:', orderId);
  
  try {
    // Parallel API calls to fetch all related data
    const [
      orderResponse,
      orderLinesResponse,
      commentsResponse,
      optionsResponse,
      fittersResponse,
      modelsResponse,
      presetsResponse,
      customersResponse,
      suppliersResponse,
      leatherTypesResponse
    ] = await Promise.all([
      // Main order data
      fetchEntities({
        entity: 'orders',
        extraParams: { id: orderId }
      }),
      
      // Order lines for this order
      fetchEntities({
        entity: 'order_lines',
        extraParams: { 
          'order.id': orderId,
          pagination: false
        }
      }),
      
      // Comments for this order
      fetchEntities({
        entity: 'comments',
        extraParams: { 
          'order.id': orderId,
          pagination: false
        }
      }),
      
      // Enforced normal option items
      fetchEntities({
        entity: 'enforced_normal_option_items',
        extraParams: { pagination: false }
      }),
      
      // Fitters (ordered by name)
      fetchEntities({
        entity: 'fitters',
        extraParams: { 
          'order[name]': 'asc',
          pagination: false
        }
      }),
      
      // Active models
      fetchEntities({
        entity: 'models',
        extraParams: { 
          status: 'ACTIVE',
          pagination: false
        }
      }),
      
      // Presets
      fetchEntities({
        entity: 'presets',
        extraParams: { pagination: false }
      }),
      
      // Customers (for search/selection)
      fetchEntities({
        entity: 'customers',
        extraParams: { pagination: false }
      }),
      
      // Factories (Suppliers)
      fetchEntities({
        entity: 'factories',
        extraParams: { pagination: false }
      }),
      
      // Leather types
      fetchEntities({
        entity: 'leathertypes',
        extraParams: { pagination: false }
      })
    ]);

    const order = orderResponse['hydra:member']?.[0] || orderResponse;
    logger.log('Fetched order:', order);

    // Get product saddle related data if the order has product saddles
    const productSaddleExtras: ComprehensiveOrderData['productSaddleExtras'] = [];
    const productSaddleItems: ComprehensiveOrderData['productSaddleItems'] = [];
    const modelItems: ComprehensiveOrderData['modelItems'] = [];
    const modelLeatherPrices: ComprehensiveOrderData['modelLeatherPrices'] = [];
    const productSaddles: ProductSaddle[] = [];

    const orderLines = orderLinesResponse['hydra:member'] || [];
    
    // For each order line, fetch related product saddle data
    for (const orderLine of orderLines) {
      if (orderLine.productSaddleId || orderLine.productSaddle?.id) {
        const productSaddleId = orderLine.productSaddleId || orderLine.productSaddle?.id;
        
        try {
          const [
            productSaddleExtrasRes,
            productSaddleItemsRes,
            productSaddlesRes
          ] = await Promise.all([
            // Product saddle extras
            fetchEntities({
              entity: 'product_saddle_extra_containers',
              extraParams: { 
                productSaddleId: productSaddleId,
                pagination: false
              }
            }),
            
            // Product saddle items
            fetchEntities({
              entity: 'product_saddle_item_containers',
              extraParams: { 
                productSaddleId: productSaddleId,
                pagination: false
              }
            }),
            
            // Product saddle details
            fetchEntities({
              entity: 'products',
              extraParams: { 
                id: productSaddleId
              }
            })
          ]);

          productSaddleExtras.push(...(productSaddleExtrasRes['hydra:member'] || []));
          productSaddleItems.push(...(productSaddleItemsRes['hydra:member'] || []));
          productSaddles.push(...(productSaddlesRes['hydra:member'] || []));
        } catch (error) {
          logger.warn('Failed to fetch product saddle data for:', productSaddleId, error);
        }
      }

      // Get model-related data if available
      if (orderLine.modelId || orderLine.model?.id) {
        const modelId = orderLine.modelId || orderLine.model?.id;
        
        try {
          const [
            modelItemsRes,
            modelLeatherPricesRes
          ] = await Promise.all([
            // Model items
            fetchEntities({
              entity: 'model_item_containers',
              extraParams: { 
                modelId: modelId,
                pagination: false
              }
            }),
            
            // Model leather prices
            fetchEntities({
              entity: 'model_leather_price_containers',
              extraParams: { 
                modelId: modelId,
                pagination: false
              }
            })
          ]);

          modelItems.push(...(modelItemsRes['hydra:member'] || []));
          modelLeatherPrices.push(...(modelLeatherPricesRes['hydra:member'] || []));
        } catch (error) {
          logger.warn('Failed to fetch model data for:', modelId, error);
        }
      }
    }

    const comprehensiveData: ComprehensiveOrderData = {
      order,
      orderLines,
      comments: commentsResponse['hydra:member'] || [],
      options: optionsResponse['hydra:member'] || [],
      productSaddleExtras,
      productSaddleItems,
      modelItems,
      modelLeatherPrices,
      fitters: fittersResponse['hydra:member'] || [],
      models: modelsResponse['hydra:member'] || [],
      presets: presetsResponse['hydra:member'] || [],
      customers: customersResponse['hydra:member'] || [],
      suppliers: suppliersResponse['hydra:member'] || [],
      leatherTypes: leatherTypesResponse['hydra:member'] || [],
      productSaddles
    };

    logger.log('Comprehensive order data loaded:', {
      orderLines: comprehensiveData.orderLines.length,
      comments: comprehensiveData.comments.length,
      options: comprehensiveData.options.length,
      productSaddleExtras: comprehensiveData.productSaddleExtras.length,
      productSaddleItems: comprehensiveData.productSaddleItems.length,
      modelItems: comprehensiveData.modelItems.length,
      modelLeatherPrices: comprehensiveData.modelLeatherPrices.length,
      fitters: comprehensiveData.fitters.length,
      models: comprehensiveData.models.length,
      presets: comprehensiveData.presets.length,
      customers: comprehensiveData.customers.length,
      suppliers: comprehensiveData.suppliers.length,
      leatherTypes: comprehensiveData.leatherTypes.length,
      productSaddles: comprehensiveData.productSaddles.length
    });

    return comprehensiveData;

  } catch (error) {
    logger.error('Error fetching comprehensive order data:', error);
    throw new Error(`Failed to fetch comprehensive order data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search customers by name (for customer selection in order editing)
 */
export async function searchCustomers(searchTerm: string, limit: number = 20): Promise<Customer[]> {
  try {
    const response = await fetchEntities({
      entity: 'customers',
      extraParams: {
        'name[contains]': searchTerm,
        pagination: true,
        limit,
        'order[name]': 'asc'
      }
    });
    
    return response['hydra:member'] || [];
  } catch (error) {
    logger.error('Error searching customers:', error);
    return [];
  }
}

/**
 * Search fitters by name (for fitter selection in order editing)
 */
export async function searchFitters(searchTerm: string, limit: number = 20): Promise<Fitter[]> {
  try {
    const response = await fetchEntities({
      entity: 'fitters',
      extraParams: {
        'name[contains]': searchTerm,
        pagination: true,
        limit,
        'order[name]': 'asc'
      }
    });
    
    return response['hydra:member'] || [];
  } catch (error) {
    logger.error('Error searching fitters:', error);
    return [];
  }
}

/**
 * Save order with all related data
 */
export async function saveComprehensiveOrder(orderData: Record<string, unknown>): Promise<unknown> {
  try {
    logger.log('Saving comprehensive order data:', orderData);
    
    // This would typically involve multiple API calls to save
    // different parts of the order (order, order lines, product saddles, etc.)
    // For now, we'll implement a basic save
    
    const response = await fetch(`${API_URL}/orders/${orderData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`Failed to save order: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error saving comprehensive order:', error);
    throw error;
  }
}

/**
 * Get available product saddle configurations for a given model
 */
export async function getProductSaddleConfigurations(modelId: number): Promise<ProductSaddle[]> {
  try {
    const response = await fetchEntities({
      entity: 'products',
      extraParams: {
        'model.id': modelId,
        pagination: false
      }
    });

    return response['hydra:member'] || [];
  } catch (error) {
    logger.error('Error fetching product saddle configurations:', error);
    return [];
  }
}