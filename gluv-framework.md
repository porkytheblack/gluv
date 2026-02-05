# Gluv Framework
- An agentic framework for building seemlessly with plug and play for both UI and functionality. 
- feels simple in your hands, and fits your agents abilities like a gluv. 
- simplifying the User interface to just a single box with limitless possibilities.
- like an internal mcp tool for your app. 

```ts
gluv.fold({ 🤜
  name: 'addProductToCart',
  description: 'Adds a product to the user's cart',
  type: 'action-constructive',
  paramsSchema: someSchema,
  resultSchema: someSchema,
  requireConfirm: boo,
  do: async (context: any, params: z.Typeof<someSchema>) =>  { 
    await context.db.insertToCart(params);
    return UIToDisplayUnderneathChatOrSomeOtherResultForProcessing
  },
undo: incase it messes up you can simply go back to the point before it happened
})
.fold({ 🤜
   name: 'removeFromCart',
   description: 'Remove an item from the cart',
   type: 'action-destructive',
   requireConfirm: true,
   params: schema, 
   result: schema,
   do: async (context: any, params: z.Type) => {
     
     await context.db.removeFromCart(params);
     return UIToDisplayUnderneathChatOrSomeOtherResult as {type: 'ui-component' | 'data' } // maybe add a way for the context to carray in if it accepts
   },
undo: incase it messes up you can simply go back to the point before it happened
})
.unfold({  🫴 // could be requesting for something with a custom form in the UI, UI updates some internal state that, can be used to trigger one of the folds, information can be hidden from the llm and the llm can just get back feedback of success or failure, or the whole data, point is this ui element will get information and then trigger something else 
   name:  'collectCardDetails',
   description: 'Collects User's Payment Information',
   type: 'ui-collect',
   ui: (form: ReactHookform form) => (JSX UI of a form),
   do: (ctx, values: Data) => {do something with the data like return it, or even access the context},
undo: incase it messes up you can simply go back to the point before it happened, but if it were a payment there would be no undo.
})
```
-----
### Gluv agent loop: 
- come up with a plan, each step has a bunch of actions
```tsx

interface GluvAction {
   sequence: number - sequence in execution steps,
   title: string,
   description: string, - an instruction to the instance gonna be handling this, coordinator already has all context, so why not be precise, however some actions may be dependent on previous ones,
- we can create a link of blocking to unblocking
- data, if the action explicitly needs data
}
```