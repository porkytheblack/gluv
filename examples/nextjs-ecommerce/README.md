# Gluv E-commerce Example

A demo e-commerce application showcasing the Gluv Framework capabilities.

## Features

- **Product Search**: Search products by name or category
- **Shopping Cart**: Add, update, remove items
- **Coupons**: Apply discount codes
- **Wishlist**: Save items for later
- **Undo**: Reverse actions with built-in undo support
- **Confirmation**: Destructive actions require confirmation

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# From the root of the monorepo
pnpm install

# Navigate to the example
cd examples/nextjs-ecommerce

# Copy environment variables
cp .env.example .env.local

# Add your API key (optional - demo uses rule-based plan generator)
# OPENAI_API_KEY=sk-your-key
```

### Running

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

Open [http://localhost:3000](http://localhost:3000).

## Try These Commands

The AI assistant understands natural language. Try:

- "Search for widgets"
- "Add the blue widget to my cart"
- "Add 3 gadget pros"
- "Show my cart"
- "Apply coupon SAVE20"
- "Clear my cart" (requires confirmation)
- "Undo" (reverses last action)

## Available Coupons

| Code | Discount |
|------|----------|
| SAVE10 | 10% off |
| SAVE20 | 20% off |
| HALF | 50% off |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Main page with chat interface
│   └── globals.css   # Global styles
└── lib/
    ├── gluv.ts       # Gluv configuration and capabilities
    ├── data.ts       # Sample product data
    └── plan-generator.ts  # Simple plan generator (replace with LLM)
```

## Capabilities Defined

### Folds (Agent Actions)

| Name | Type | Description |
|------|------|-------------|
| searchProducts | idempotent | Search products by query |
| getProductDetails | idempotent | Get product information |
| addToCart | constructive | Add item to cart |
| updateCartQuantity | constructive | Update cart item quantity |
| removeFromCart | destructive | Remove item (requires confirm) |
| clearCart | destructive | Clear cart (requires confirm) |
| getCart | idempotent | View cart contents |
| applyCoupon | constructive | Apply discount code |
| addToWishlist | constructive | Save to wishlist |
| getWishlist | idempotent | View wishlist |

## Using with Real LLM

Replace the rule-based plan generator with an actual LLM:

```typescript
// src/lib/plan-generator.ts
import { createOpenAIPlanGenerator } from '@gluv/adapters/openai'

export const generatePlan = createOpenAIPlanGenerator({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4-turbo-preview',
})
```

Or create a Next.js API route:

```typescript
// app/api/chat/route.ts
import { createVercelAIChatHandler } from '@gluv/adapters/vercel-ai'
import { openai } from '@ai-sdk/openai'
import { gluv } from '@/lib/gluv'

export const { POST } = createVercelAIChatHandler({
  model: openai('gpt-4-turbo'),
  capabilities: gluv.getCapabilities(),
})
```

## Customization

### Adding New Capabilities

```typescript
// In src/lib/gluv.ts
gluv.fold({
  name: 'checkout',
  description: 'Process checkout and create order',
  type: 'action-constructive',
  requireConfirm: true,  // Require user confirmation
  paramsSchema: z.object({
    paymentMethod: z.string(),
    shippingAddress: z.string(),
  }),
  resultSchema: z.object({
    orderId: z.string(),
    total: z.number(),
  }),
  do: async (ctx, params) => {
    // Process order
    return { status: 'success', data: { orderId: '...', total: 99.99 } }
  },
})
```

### Adding Unfolds (User Input Forms)

```typescript
gluv.unfold({
  name: 'collectShippingAddress',
  description: 'Collect shipping address from user',
  type: 'ui-collect',
  visibility: {
    llmCanSeeData: true,
    llmFeedback: 'summary',
  },
  paramsSchema: z.object({}),
  resultSchema: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
  ui: (form, ctx) => (
    <form>
      <input {...form.register('street')} placeholder="Street" />
      <input {...form.register('city')} placeholder="City" />
      <input {...form.register('state')} placeholder="State" />
      <input {...form.register('zip')} placeholder="ZIP" />
    </form>
  ),
  do: async (ctx, values) => {
    return { status: 'success', data: values }
  },
})
```

## License

MIT
