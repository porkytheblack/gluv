/**
 * Sample product data for the e-commerce example.
 */

export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  inStock: boolean
  imageUrl?: string
}

export const products: Product[] = [
  {
    id: 'widget-blue',
    name: 'Blue Widget',
    description: 'A beautiful blue widget perfect for any occasion.',
    price: 29.99,
    category: 'Widgets',
    inStock: true,
    imageUrl: '/products/widget-blue.jpg',
  },
  {
    id: 'widget-red',
    name: 'Red Widget',
    description: 'A vibrant red widget that stands out from the crowd.',
    price: 34.99,
    category: 'Widgets',
    inStock: true,
    imageUrl: '/products/widget-red.jpg',
  },
  {
    id: 'widget-green',
    name: 'Green Widget',
    description: 'An eco-friendly green widget made from recycled materials.',
    price: 39.99,
    category: 'Widgets',
    inStock: false,
    imageUrl: '/products/widget-green.jpg',
  },
  {
    id: 'gadget-pro',
    name: 'Gadget Pro',
    description: 'The ultimate gadget for power users. Features advanced capabilities.',
    price: 149.99,
    category: 'Gadgets',
    inStock: true,
    imageUrl: '/products/gadget-pro.jpg',
  },
  {
    id: 'gadget-lite',
    name: 'Gadget Lite',
    description: 'A lightweight gadget for everyday use. Simple and efficient.',
    price: 79.99,
    category: 'Gadgets',
    inStock: true,
    imageUrl: '/products/gadget-lite.jpg',
  },
  {
    id: 'gizmo-deluxe',
    name: 'Gizmo Deluxe',
    description: 'The deluxe edition gizmo with premium features and finish.',
    price: 199.99,
    category: 'Gizmos',
    inStock: true,
    imageUrl: '/products/gizmo-deluxe.jpg',
  },
  {
    id: 'gizmo-basic',
    name: 'Gizmo Basic',
    description: 'A basic gizmo that gets the job done. Great for beginners.',
    price: 49.99,
    category: 'Gizmos',
    inStock: true,
    imageUrl: '/products/gizmo-basic.jpg',
  },
  {
    id: 'accessory-pack',
    name: 'Accessory Pack',
    description: 'A bundle of essential accessories for your widgets and gadgets.',
    price: 24.99,
    category: 'Accessories',
    inStock: true,
    imageUrl: '/products/accessory-pack.jpg',
  },
  {
    id: 'premium-case',
    name: 'Premium Case',
    description: 'A premium carrying case to protect your valuable items.',
    price: 59.99,
    category: 'Accessories',
    inStock: true,
    imageUrl: '/products/premium-case.jpg',
  },
  {
    id: 'starter-kit',
    name: 'Starter Kit',
    description: 'Everything you need to get started. Includes widget, gadget, and accessories.',
    price: 99.99,
    category: 'Kits',
    inStock: true,
    imageUrl: '/products/starter-kit.jpg',
  },
]

export const categories = ['Widgets', 'Gadgets', 'Gizmos', 'Accessories', 'Kits']
