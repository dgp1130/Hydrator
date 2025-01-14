# HydroActive

HydroActive is a experimental library for hydrating web components and adding
"sprinkles of reactivity" to pre-rendered HTML.

Check out the [YouTube video](https://www.youtube.com/watch?v=zL0TzFY6aj0) for an in-depth
discussion and demo of HydroActive's features. Note that this video discusses a very early
version of HydroActive. Versions up through 0.0.5 roughly align with that video, however
HydroActive is currently being redesigned and rewritten, so it may not be up to date with
the current version of the library.

## Premise

Most server-side rendering / static site generation solutions bind the client and
server together with a shared implementation. Components are "hybrid rendered" by
supporting both the client _and_ the server. They are rendered first on the server and
usually props are serialized and passed to the client as JSON. The components then
rerender on the client and take over interactivity.

While many frameworks tweak this approach in various ways, a few aspects of it have
always bothered me:

1.  Why are the client and server coupled together? Why can't I use a different language
    or framework on my server or even change it without completely breaking my frontend
    application?
1.  Why are _all_ components hybrid rendered? Most tend to be completely static and
    should be rendered exactly once on the server and never again on the client, but
    every component is implicitly rendered in both contexts.
1.  Why are we passing a JSON side-channel to the client? This seems unnecessary given
    that we already have the rendered HTML, why do we need to duplicate that
    information in a different structure?
1.  Why do I have to write my components to be hybrid-compatible? Why can't I write the
    server-side rendered components and directly read the file system, while my
    client-side rendered components could directly access browser APIs?
1.  Why do components need to rerender on the client when anything changes? 90% of a
    component is often static, when updating some text that's the only thing which
    should change. That's the only thing the client-side component should know _how_ to
    change.

These are complaints of a generic strawman SSR/SSG solution, each framework is different
and has different answers to these particular problems. Instead, I want to think of
hydration through a different lens:

## Mental model

Servers are good at rendering HTML and returning it in HTTP responses. That's kind of
their thing, we don't need to reinvent that. If you have a Node, Java, Ruby, Haskell,
C, or even Fortran server, any of them should be fine. **How a server renders HTML is
an unrelated implementation detail.** HydroActive focuses on taking that pre-rendered
HTML and making it interactive on the client.

This means we can think of hydration as a purely deserialization problem. Servers can
render web components without any fancy tooling or integrations, all they need to do
is render something like:

```html
<my-counter>
    <div>The current count is <span>5</span>.</div>
    <button>Increment</button>
</my-counter>
```

Any server can do that, exactly how it does so is unimportant to HydroActive. From
here, HydroActive makes it easy to load from this component and make it interactable.
It does this by providing an API to define custom elements with useful lifecycle and
convenient DOM APIs. One example would be:

```typescript
import { ElementAccessor, component } from 'hydroactive';
import { WriteableSignal } from 'hydroactive/signals.js';

// `component()` creates a web component class based on the given hydration
// function. The callback is invoked on hydration and provides `host` parameter
// with additional functionality to provide interactivity to the pre-rendered
// component.
const MyCounter = component('my-counter', (host) => {
    // Interacting with a site using HydroActive is a three-step process:
    // 1. Query it - `host.query` queries the DOM for the selector and asserts
    // it is found.
    const countEl: ElementAccessor<HTMLSpanElement> = host.query('span#count')
        // 2. Hydrate it - `.access` asserts that the element does not need to
        // be hydrated. Alternatively, we could call `.hydrate()` to trigger
        // hydration on a sub-component.
        .access();

    // 3. Enhance it - `live` creates a `Signal` which wraps the `textContent`
    // of `countEl`. The text is interpreted as a `number` and implicitly
    // converted. Also whenever `count.set` is called, the `<span>` tag is
    // automatically updated.
    const count: WriteableSignal<number> = live(countEl, host, Number);

    // Prints `5`, hydrated from initial HTML content.
    console.log(count());

    // HydroActive providers ergonomic wrappers to read elements from the DOM,
    // assert they exist, and use them safely. It also types the result based on
    // the query, this implicitly has type `ElementAccessor<HTMLButtonElement>`.
    const incrementBtn = host.query('button').access();

    // HydroActive also provides ergonomic wrapper to bind event listeners.
    // This automatically removes and re-adds the listener when `<my-counter>`
    // is disconnected from and reconnected to the DOM.
    incrementBtn.listen(host, 'click', () => {
        // `count.set` automatically updates the underlying DOM with the new
        // value.
        count.set(count() + 1);
    });
});

// Define the custom element, upgrading any `<my-element>` tags on the page.
MyCounter.define();

// For TypeScript, don't forget to type `my-counter` tags as an instance of the
// class.
declare global {
    interface HTMLElementTagNameMap {
        'my-counter': InstanceType<typeof MyCounter>;
    }
}
```

See the [demo](/src/demo/) for more cool features. You can run the demo locally with
`npm start`. The HTML pages contain hard-coded, pre-rendered HTML (remember, how
they get rendered by the server is an implementation detail). The TypeScript files
house the component's implementations and demonstrate different forms of reactivity
and use cases.

## Internal

### Testing

Run tests with `npm test`. Debug tests with `npm run test-debug` and then opening
[`localhost:8000`](http://localhost:8000/).

### Publishing

1.  Make sure you're on the right Node version.
    ```shell
    nvm install
    ```
1.  Increment the version number in [`package.json`](/package.json).
1.  Make sure tests pass:
    ```shell
    npm test
    ```
1.  Update the version in the lockfile.
    ```shell
    npm install
    ```
    Make sure no other dependencies were updated.
1.  Then build and publish the package:
    ```shell
    npm run build
    (cd dist/ && npm publish)
    # Alternatively run `(cd dist/ && npm pack)` to inspect the tarball to be published.
    ```
1.  Commit, tag, and push the incremented version number.
    ```shell
    git add . && git commit -m "Release v0.0.1."
    git tag releases/0.0.1
    git push
    git push --tags
    ```
1.  Go to [GitHub releases](https://github.com/dgp1130/HydroActive/releases/) and create a
    new release with a changelog.
