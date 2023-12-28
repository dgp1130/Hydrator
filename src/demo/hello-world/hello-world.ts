import { defineComponent } from 'hydroactive';

/** Says hello to HydroActive on hydration. */
export const HelloWorld = defineComponent('hello-world', (comp) => {
  // Create a "live" binding with the `#name` element and create a `string`
  // signal bound to the element's `textContent`.
  const name = comp.live('#name', String);

  // Update the name in the DOM.
  name.set('HydroActive');
});

// Declare the component tag name for improved type inference in TypeScript.
declare global {
  interface HTMLElementTagNameMap {
    'hello-world': InstanceType<typeof HelloWorld>;
  }
}