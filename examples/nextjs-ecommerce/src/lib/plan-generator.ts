/**
 * Plan generator for the e-commerce example.
 *
 * In a real application, this would call an LLM API.
 * For the demo, we use a simple rule-based approach.
 */

import type { PlanGeneratorInput, PlanGeneratorOutput } from '@gluv/react'

/**
 * Simple rule-based plan generator for demonstration.
 * Replace with actual LLM integration in production.
 */
export async function generatePlan(input: PlanGeneratorInput): Promise<PlanGeneratorOutput> {
  const message = input.userMessage.toLowerCase()

  // Search products
  if (message.includes('search') || message.includes('find') || message.includes('looking for')) {
    const queryMatch = message.match(/(?:search|find|looking for)\s+(?:for\s+)?(.+)/i)
    const query = queryMatch?.[1]?.trim() ?? message

    return {
      reasoning: 'User wants to search for products',
      response: `I'll search for "${query}" in our catalog.`,
      actions: [
        {
          title: 'Search Products',
          description: `Searching for products matching "${query}"`,
          capabilityName: 'searchProducts',
          params: { query, maxResults: 5 },
          blockedBy: [],
        },
      ],
    }
  }

  // Add to cart
  if (message.includes('add') && message.includes('cart')) {
    // Try to extract product name
    let productId = 'widget-blue' // default

    if (message.includes('blue widget') || message.includes('blue')) {
      productId = 'widget-blue'
    } else if (message.includes('red widget') || message.includes('red')) {
      productId = 'widget-red'
    } else if (message.includes('green widget') || message.includes('green')) {
      productId = 'widget-green'
    } else if (message.includes('gadget pro') || message.includes('pro gadget')) {
      productId = 'gadget-pro'
    } else if (message.includes('gadget lite') || message.includes('lite gadget')) {
      productId = 'gadget-lite'
    } else if (message.includes('gizmo deluxe') || message.includes('deluxe gizmo')) {
      productId = 'gizmo-deluxe'
    } else if (message.includes('gizmo basic') || message.includes('basic gizmo')) {
      productId = 'gizmo-basic'
    } else if (message.includes('starter kit') || message.includes('kit')) {
      productId = 'starter-kit'
    }

    // Extract quantity
    const quantityMatch = message.match(/(\d+)/g)
    const quantity = quantityMatch ? parseInt(quantityMatch[0], 10) : 1

    return {
      reasoning: 'User wants to add an item to their cart',
      response: `I'll add that to your cart.`,
      actions: [
        {
          title: 'Add to Cart',
          description: `Adding ${quantity} item(s) to cart`,
          capabilityName: 'addToCart',
          params: { productId, quantity },
          blockedBy: [],
        },
      ],
    }
  }

  // View cart
  if (message.includes('cart') && (message.includes('show') || message.includes('view') || message.includes('what'))) {
    return {
      reasoning: 'User wants to see their cart',
      response: "Here's what's in your cart.",
      actions: [
        {
          title: 'Get Cart',
          description: 'Retrieving cart contents',
          capabilityName: 'getCart',
          params: {},
          blockedBy: [],
        },
      ],
    }
  }

  // Clear cart
  if (message.includes('clear') && message.includes('cart')) {
    return {
      reasoning: 'User wants to clear their cart',
      response: "I'll clear your cart. This requires confirmation.",
      actions: [
        {
          title: 'Clear Cart',
          description: 'Removing all items from cart',
          capabilityName: 'clearCart',
          params: {},
          blockedBy: [],
        },
      ],
    }
  }

  // Apply coupon
  if (message.includes('coupon') || message.includes('discount') || message.includes('code')) {
    const codeMatch = message.match(/\b(save\d+|half|[a-z]+\d+)\b/i)
    const code = codeMatch?.[1] ?? 'SAVE10'

    return {
      reasoning: 'User wants to apply a coupon',
      response: `I'll apply the coupon "${code.toUpperCase()}" to your cart.`,
      actions: [
        {
          title: 'Apply Coupon',
          description: `Applying coupon code ${code.toUpperCase()}`,
          capabilityName: 'applyCoupon',
          params: { code },
          blockedBy: [],
        },
      ],
    }
  }

  // Add to wishlist
  if (message.includes('wishlist') && message.includes('add')) {
    return {
      reasoning: 'User wants to add to wishlist',
      response: "I'll add that to your wishlist.",
      actions: [
        {
          title: 'Add to Wishlist',
          description: 'Adding product to wishlist',
          capabilityName: 'addToWishlist',
          params: { productId: 'widget-blue' },
          blockedBy: [],
        },
      ],
    }
  }

  // View wishlist
  if (message.includes('wishlist') && (message.includes('show') || message.includes('view'))) {
    return {
      reasoning: 'User wants to see their wishlist',
      response: "Here's your wishlist.",
      actions: [
        {
          title: 'Get Wishlist',
          description: 'Retrieving wishlist',
          capabilityName: 'getWishlist',
          params: {},
          blockedBy: [],
        },
      ],
    }
  }

  // Undo
  if (message.includes('undo')) {
    return {
      reasoning: 'User wants to undo the last action',
      response: "I'll undo the last action.",
      actions: [], // Undo is handled separately
    }
  }

  // Default: conversational response
  return {
    reasoning: 'User message is conversational or unclear',
    response: `I can help you with:
- Searching for products ("search for widgets")
- Adding items to cart ("add blue widget to cart")
- Viewing your cart ("show my cart")
- Applying coupons ("apply coupon SAVE10")
- Managing your wishlist

What would you like to do?`,
    actions: [],
  }
}
