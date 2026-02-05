'use client'

import { GluvProvider, GluvChatInterface, useCapabilities, useUndo } from '@gluv/react'
import { gluv, products } from '@/lib/gluv'
import { generatePlan } from '@/lib/plan-generator'

function Header() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Gluv Store</h1>
          <p className="text-sm text-blue-200">AI-powered shopping assistant</p>
        </div>
        <div className="flex items-center gap-4">
          <UndoButton />
        </div>
      </div>
    </div>
  )
}

function UndoButton() {
  const { canUndo, undo, isUndoing, undoCount } = useUndo()

  return (
    <button
      onClick={undo}
      disabled={!canUndo || isUndoing}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path
          fillRule="evenodd"
          d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z"
          clipRule="evenodd"
        />
      </svg>
      {isUndoing ? 'Undoing...' : `Undo${undoCount > 0 ? ` (${undoCount})` : ''}`}
    </button>
  )
}

function CapabilitiesPanel() {
  const { capabilities, folds, unfolds } = useCapabilities()

  return (
    <div className="p-4 bg-white border-r overflow-y-auto">
      <h2 className="font-semibold text-gray-700 mb-3">Available Actions</h2>
      <div className="space-y-2">
        {folds.map((cap) => (
          <div
            key={cap.name}
            className="p-2 bg-gray-50 rounded text-sm"
          >
            <div className="font-medium text-gray-800">{cap.name}</div>
            <div className="text-gray-500 text-xs">{cap.description}</div>
            <div className="flex gap-1 mt-1">
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  cap.type === 'action-destructive'
                    ? 'bg-red-100 text-red-700'
                    : cap.type === 'action-constructive'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {cap.type.replace('action-', '')}
              </span>
              {cap.requireConfirm && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                  confirm
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductsPanel() {
  return (
    <div className="p-4 bg-white border-l overflow-y-auto">
      <h2 className="font-semibold text-gray-700 mb-3">Products</h2>
      <div className="space-y-2">
        {products.slice(0, 6).map((product) => (
          <div
            key={product.id}
            className="p-2 bg-gray-50 rounded text-sm"
          >
            <div className="font-medium text-gray-800">{product.name}</div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-green-600 font-medium">
                ${product.price.toFixed(2)}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  product.inStock
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 text-sm mb-2">Try saying:</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>"Search for widgets"</li>
          <li>"Add the blue widget to my cart"</li>
          <li>"Show my cart"</li>
          <li>"Apply coupon SAVE20"</li>
          <li>"Clear my cart"</li>
        </ul>
      </div>
    </div>
  )
}

function ChatArea() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <GluvChatInterface
        gluv={gluv}
        planGenerator={generatePlan}
        placeholder="Ask me about products, add items to cart, or apply coupons..."
        header={<Header />}
        className="h-full"
        initialMessages={[
          {
            id: 'welcome',
            role: 'assistant',
            content: `Welcome to Gluv Store! I'm your AI shopping assistant. I can help you:

• Search for products
• Add items to your cart
• Apply discount coupons
• View your cart and wishlist

What would you like to do today?`,
            timestamp: Date.now(),
            status: 'completed',
          },
        ]}
      />
    </div>
  )
}

export default function Home() {
  return (
    <GluvProvider gluv={gluv}>
      <main className="h-screen flex">
        {/* Left sidebar - Capabilities */}
        <div className="w-64 hidden lg:block">
          <CapabilitiesPanel />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <ChatArea />
        </div>

        {/* Right sidebar - Products */}
        <div className="w-72 hidden xl:block">
          <ProductsPanel />
        </div>
      </main>
    </GluvProvider>
  )
}
