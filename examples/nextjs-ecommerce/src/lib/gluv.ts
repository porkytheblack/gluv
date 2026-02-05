/**
 * Gluv configuration for the e-commerce example.
 *
 * This file demonstrates how to set up Gluv with various capabilities
 * for an e-commerce application.
 */

import { createGluv, type GluvContext, type ActionResult } from '@gluv/core'
import { z } from 'zod'
import { products, type Product } from './data'

// ============================================================================
// In-memory store (replace with real database in production)
// ============================================================================

interface CartItem {
  productId: string
  quantity: number
  addedAt: Date
}

interface Order {
  id: string
  items: CartItem[]
  total: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered'
  createdAt: Date
}

// Simulated in-memory state
const store = {
  cart: [] as CartItem[],
  orders: [] as Order[],
  wishlist: [] as string[],
}

// ============================================================================
// Helper functions
// ============================================================================

function getProduct(productId: string): Product | undefined {
  return products.find((p) => p.id === productId)
}

function calculateCartTotal(): number {
  return store.cart.reduce((total, item) => {
    const product = getProduct(item.productId)
    return total + (product?.price ?? 0) * item.quantity
  }, 0)
}

// ============================================================================
// Create Gluv instance with capabilities
// ============================================================================

export const gluv = createGluv({
  id: 'ecommerce-gluv',
  context: {
    auth: {
      userId: 'user_demo',
      sessionId: 'session_demo',
      roles: ['user'],
      permissions: ['cart:read', 'cart:write', 'orders:read', 'orders:write'],
    },
  },
})
  // =========================================================================
  // Product Queries (Idempotent)
  // =========================================================================
  .fold({
    name: 'searchProducts',
    description: 'Search for products by name, category, or description',
    type: 'action-idempotent',
    tags: ['products', 'search'],
    paramsSchema: z.object({
      query: z.string().describe('Search query'),
      category: z.string().optional().describe('Filter by category'),
      maxResults: z.number().int().positive().default(10).describe('Maximum results'),
    }),
    resultSchema: z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          category: z.string(),
          inStock: z.boolean(),
        })
      ),
      totalCount: z.number(),
    }),
    do: async (ctx, params) => {
      const query = params.query.toLowerCase()
      const filtered = products
        .filter((p) => {
          const matchesQuery =
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
          const matchesCategory = !params.category || p.category === params.category
          return matchesQuery && matchesCategory
        })
        .slice(0, params.maxResults)

      return {
        status: 'success',
        data: {
          products: filtered.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            inStock: p.inStock,
          })),
          totalCount: filtered.length,
        },
      }
    },
  })

  .fold({
    name: 'getProductDetails',
    description: 'Get detailed information about a specific product',
    type: 'action-idempotent',
    tags: ['products'],
    paramsSchema: z.object({
      productId: z.string().describe('The product ID'),
    }),
    resultSchema: z.object({
      product: z
        .object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          price: z.number(),
          category: z.string(),
          inStock: z.boolean(),
          imageUrl: z.string().optional(),
        })
        .nullable(),
    }),
    do: async (ctx, params) => {
      const product = getProduct(params.productId)

      return {
        status: 'success',
        data: {
          product: product
            ? {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                category: product.category,
                inStock: product.inStock,
                imageUrl: product.imageUrl,
              }
            : null,
        },
      }
    },
  })

  // =========================================================================
  // Cart Management (Constructive)
  // =========================================================================
  .fold({
    name: 'addToCart',
    description: 'Add a product to the shopping cart',
    type: 'action-constructive',
    tags: ['cart'],
    paramsSchema: z.object({
      productId: z.string().describe('Product ID to add'),
      quantity: z.number().int().positive().default(1).describe('Quantity to add'),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      cartItemCount: z.number(),
      cartTotal: z.number(),
      message: z.string(),
    }),
    do: async (ctx, params) => {
      const product = getProduct(params.productId)

      if (!product) {
        return {
          status: 'failure',
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product ${params.productId} not found`,
            recoverable: true,
          },
        }
      }

      if (!product.inStock) {
        return {
          status: 'failure',
          error: {
            code: 'OUT_OF_STOCK',
            message: `${product.name} is currently out of stock`,
            recoverable: true,
          },
        }
      }

      // Check if already in cart
      const existingItem = store.cart.find((item) => item.productId === params.productId)

      if (existingItem) {
        existingItem.quantity += params.quantity
      } else {
        store.cart.push({
          productId: params.productId,
          quantity: params.quantity,
          addedAt: new Date(),
        })
      }

      return {
        status: 'success',
        data: {
          success: true,
          cartItemCount: store.cart.length,
          cartTotal: calculateCartTotal(),
          message: `Added ${params.quantity}x ${product.name} to cart`,
        },
      }
    },
    captureUndoData: async (ctx, params) => {
      const existingItem = store.cart.find((item) => item.productId === params.productId)
      return {
        existed: !!existingItem,
        previousQuantity: existingItem?.quantity ?? 0,
      }
    },
    undo: async (ctx, snapshot) => {
      const params = snapshot.params as { productId: string; quantity: number }
      const undoData = snapshot.undoData as { existed: boolean; previousQuantity: number }

      if (undoData.existed) {
        const item = store.cart.find((i) => i.productId === params.productId)
        if (item) {
          item.quantity = undoData.previousQuantity
        }
      } else {
        store.cart = store.cart.filter((i) => i.productId !== params.productId)
      }

      return { success: true }
    },
  })

  .fold({
    name: 'updateCartQuantity',
    description: 'Update the quantity of an item in the cart',
    type: 'action-constructive',
    tags: ['cart'],
    paramsSchema: z.object({
      productId: z.string().describe('Product ID'),
      quantity: z.number().int().positive().describe('New quantity'),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      cartTotal: z.number(),
    }),
    do: async (ctx, params) => {
      const item = store.cart.find((i) => i.productId === params.productId)

      if (!item) {
        return {
          status: 'failure',
          error: {
            code: 'ITEM_NOT_IN_CART',
            message: 'Item not found in cart',
            recoverable: true,
          },
        }
      }

      item.quantity = params.quantity

      return {
        status: 'success',
        data: {
          success: true,
          cartTotal: calculateCartTotal(),
        },
      }
    },
    captureUndoData: async (ctx, params) => {
      const item = store.cart.find((i) => i.productId === params.productId)
      return { previousQuantity: item?.quantity ?? 0 }
    },
    undo: async (ctx, snapshot) => {
      const params = snapshot.params as { productId: string }
      const undoData = snapshot.undoData as { previousQuantity: number }

      const item = store.cart.find((i) => i.productId === params.productId)
      if (item) {
        item.quantity = undoData.previousQuantity
      }

      return { success: true }
    },
  })

  // =========================================================================
  // Cart Management (Destructive)
  // =========================================================================
  .fold({
    name: 'removeFromCart',
    description: 'Remove an item from the shopping cart',
    type: 'action-destructive',
    requireConfirm: true,
    tags: ['cart'],
    paramsSchema: z.object({
      productId: z.string().describe('Product ID to remove'),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      cartItemCount: z.number(),
      cartTotal: z.number(),
    }),
    do: async (ctx, params) => {
      const itemIndex = store.cart.findIndex((i) => i.productId === params.productId)

      if (itemIndex === -1) {
        return {
          status: 'failure',
          error: {
            code: 'ITEM_NOT_IN_CART',
            message: 'Item not found in cart',
            recoverable: true,
          },
        }
      }

      store.cart.splice(itemIndex, 1)

      return {
        status: 'success',
        data: {
          success: true,
          cartItemCount: store.cart.length,
          cartTotal: calculateCartTotal(),
        },
      }
    },
    captureUndoData: async (ctx, params) => {
      const item = store.cart.find((i) => i.productId === params.productId)
      return { removedItem: item ? { ...item } : null }
    },
    undo: async (ctx, snapshot) => {
      const undoData = snapshot.undoData as { removedItem: CartItem | null }

      if (undoData.removedItem) {
        store.cart.push(undoData.removedItem)
      }

      return { success: true }
    },
  })

  .fold({
    name: 'clearCart',
    description: 'Remove all items from the shopping cart',
    type: 'action-destructive',
    requireConfirm: true,
    tags: ['cart'],
    paramsSchema: z.object({}),
    resultSchema: z.object({
      success: z.boolean(),
      itemsRemoved: z.number(),
    }),
    do: async (ctx, params) => {
      const itemsRemoved = store.cart.length
      store.cart = []

      return {
        status: 'success',
        data: {
          success: true,
          itemsRemoved,
        },
      }
    },
    captureUndoData: async (ctx, params) => {
      return { previousCart: [...store.cart] }
    },
    undo: async (ctx, snapshot) => {
      const undoData = snapshot.undoData as { previousCart: CartItem[] }
      store.cart = undoData.previousCart

      return { success: true }
    },
  })

  // =========================================================================
  // Cart Queries
  // =========================================================================
  .fold({
    name: 'getCart',
    description: 'Get the current shopping cart contents',
    type: 'action-idempotent',
    tags: ['cart'],
    paramsSchema: z.object({}),
    resultSchema: z.object({
      items: z.array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          subtotal: z.number(),
        })
      ),
      total: z.number(),
      itemCount: z.number(),
    }),
    do: async (ctx, params) => {
      const items = store.cart.map((item) => {
        const product = getProduct(item.productId)
        return {
          productId: item.productId,
          productName: product?.name ?? 'Unknown',
          quantity: item.quantity,
          unitPrice: product?.price ?? 0,
          subtotal: (product?.price ?? 0) * item.quantity,
        }
      })

      return {
        status: 'success',
        data: {
          items,
          total: calculateCartTotal(),
          itemCount: store.cart.length,
        },
      }
    },
  })

  // =========================================================================
  // Coupon Management
  // =========================================================================
  .fold({
    name: 'applyCoupon',
    description: 'Apply a discount coupon to the cart',
    type: 'action-constructive',
    tags: ['cart', 'discounts'],
    paramsSchema: z.object({
      code: z.string().describe('Coupon code'),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      discount: z.number(),
      newTotal: z.number(),
      message: z.string(),
    }),
    do: async (ctx, params) => {
      // Simulated coupon validation
      const coupons: Record<string, number> = {
        SAVE10: 0.1,
        SAVE20: 0.2,
        HALF: 0.5,
      }

      const discountRate = coupons[params.code.toUpperCase()]

      if (!discountRate) {
        return {
          status: 'failure',
          error: {
            code: 'INVALID_COUPON',
            message: `Coupon "${params.code}" is not valid`,
            recoverable: true,
          },
        }
      }

      const cartTotal = calculateCartTotal()
      const discount = cartTotal * discountRate
      const newTotal = cartTotal - discount

      return {
        status: 'success',
        data: {
          success: true,
          discount,
          newTotal,
          message: `Coupon ${params.code} applied! You saved $${discount.toFixed(2)}`,
        },
      }
    },
  })

  // =========================================================================
  // Wishlist Management
  // =========================================================================
  .fold({
    name: 'addToWishlist',
    description: 'Add a product to the wishlist',
    type: 'action-constructive',
    tags: ['wishlist'],
    paramsSchema: z.object({
      productId: z.string().describe('Product ID to add'),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      wishlistCount: z.number(),
    }),
    do: async (ctx, params) => {
      if (!store.wishlist.includes(params.productId)) {
        store.wishlist.push(params.productId)
      }

      return {
        status: 'success',
        data: {
          success: true,
          wishlistCount: store.wishlist.length,
        },
      }
    },
    undo: async (ctx, snapshot) => {
      const params = snapshot.params as { productId: string }
      store.wishlist = store.wishlist.filter((id) => id !== params.productId)
      return { success: true }
    },
  })

  .fold({
    name: 'getWishlist',
    description: 'Get all items in the wishlist',
    type: 'action-idempotent',
    tags: ['wishlist'],
    paramsSchema: z.object({}),
    resultSchema: z.object({
      items: z.array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          price: z.number(),
          inStock: z.boolean(),
        })
      ),
    }),
    do: async (ctx, params) => {
      const items = store.wishlist
        .map((productId) => {
          const product = getProduct(productId)
          return product
            ? {
                productId,
                productName: product.name,
                price: product.price,
                inStock: product.inStock,
              }
            : null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

      return {
        status: 'success',
        data: { items },
      }
    },
  })

// Export for use in components
export type { Product }
export { products }
