import { AttrAccessor } from './attribute-accessor.js';
import { Connectable } from './connectable.js';
import { Dehydrated } from './dehydrated.js';
import { QueryAllResult, QueryResult, QueryRoot } from './query-root.js';
import { Queryable } from './queryable.js';
import { ElementSerializerToken, ResolveSerializer, resolveSerializer } from './serializer-tokens.js';
import { Serialized, ElementSerializer, ElementSerializable } from './serializers.js';

/**
 * Wraps an {@link Element} in a convenient wrapper for querying and accessing
 * it's contents with serializers.
 */
export class ElementAccessor<out El extends Element> implements Queryable<El> {
  /** The underlying wrapped {@link Element} object. */
  public readonly element: El;

  readonly #root: QueryRoot<El>;

  protected constructor(element: El, root: QueryRoot<El>) {
    this.element = element;
    this.#root = root;
  }

  /**
   * Provides an {@link ElementAccessor} for the given element.
   *
   * @param native The native {@link Element} to wrap.
   * @param getClosedShadowRoot A function to get the closed shadow root of the
   *     given root element. If the element does not have a closed shadow root
   *     and will never receive one, this can be left `undefined`. Open shadow
   *     root are automatically handled and do not require any additional input.
   * @returns An {@link ElementAccessor} wrapping the given element.
   */
  public static from<El extends Element>(
    native: El,
    getClosedShadowRoot?: () => ShadowRoot | null,
  ): ElementAccessor<El> {
    return new ElementAccessor(
        native, QueryRoot.from(native, getClosedShadowRoot));
  }

  /**
   * Returns an {@link AttrAccessor} for the given attribute on the underlying
   * element.
   *
   * @param name The name of the attribute to wrap in the {@link AttrAccessor}.
   * @returns An {@link AttrAccessor} wrapping the given attribute on the
   *     underlying element.
   */
  public attr(name: string): AttrAccessor {
    return AttrAccessor.from(this.element, name);
  }

  /**
   * Provides the value of the text content on the underlying element.
   *
   * @param token A "token" which identifiers an {@link ElementSerializer} to
   *     deserialize the read string. A token is one of:
   *     *   A primitive serializer - {@link String}, {@link Boolean},
   *         {@link Number}, {@link BigInt}.
   *     *   An {@link ElementSerializer} object.
   *     *   A {@link ElementSerializable} object.
   * @returns The value of the text content for this element deserialized based
   *     on the input token.
   */
  public read<Token extends ElementSerializerToken<any, El>>(token: Token):
      Serialized<ResolveSerializer<
        Token,
        ElementSerializer<unknown, El>,
        ElementSerializable<unknown, El>
      >> {
    const serializer = resolveSerializer<
      Token,
      ElementSerializer<unknown, El>,
      ElementSerializable<unknown, El>
    >(token);

    return serializer.deserializeFrom(this.element);
  }

  /**
   * Writes the given {@param value}, serialized with the serializer provided by
   * {@param token}, to the current element.
   *
   * @param value The value to be serialized and written to the element.
   * @param token A "token" which identifiers an {@link ElementSerializer} to
   *     serialize the value. A token is one of:
   *     *   A primitive serializer - {@link String}, {@link Boolean},
   *         {@link Number}, {@link BigInt}.
   *     *   An {@link ElementSerializer} object.
   *     *   A {@link ElementSerializable} object.
   */
  public write<Value, Token extends ElementSerializerToken<Value, El>>(
    value: Value,
    token: Token,
  ): void {
    const serializer = resolveSerializer(token) as ElementSerializer<Value, El>;
    serializer.serializeTo(value, this.element);
  }

  /**
   * Creates an event listener for the given event which invokes the provided
   * handler callback function. This listener is automatically created and
   * removed as the component is connected and disconnected from the DOM,
   * meaning the listener does not leak memory and does not need to be manually
   * cleaned up.
   *
   * @param host The {@link Connectable} object to bind the lifecycle to. The
   *     listener will be automatically added / removed when the associated
   *     component is connected / disconnected from the DOM.
   * @param event The name of the event to listen for.
   * @param handler The event handler to invoke whenever an associated event is
   *     dispatched.
   * @param options Additional options.
   *     * `capture` - [See `capture` documentation for `addEventListener`.](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#capture)
   *     * `passive` - [See `passive` documentation for `addEventListener`.](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive)
   */
  // Type `HTMLElement` events for improved autocompletion.
  public listen<EventName extends keyof AllElementsEventMap>(
    host: Connectable,
    event: EventName,
    handler: (event: AllElementsEventMap[EventName]) => void,
    options?: { capture?: boolean, passive?: boolean },
  ): void;

  // Overload with generic `string` types so we don't disallow custom events.
  public listen(
    host: Connectable,
    event: string,
    handler: (event: Event) => void,
    options?: { capture?: boolean, passive?: boolean },
  ): void;

  public listen(
    host: Connectable,
    event: string,
    handler: (event: Event) => void,
    { capture, passive }: { capture?: boolean, passive?: boolean } = {},
  ): void {
    host.connected(() => {
      this.element.addEventListener(event, handler, { capture, passive });

      return () => {
        this.element.removeEventListener(event, handler, { capture });
      };
    });
  }

  /**
   * Queries light DOM descendants for the provided selector and returns the
   * first matching element wrapped in a {@link Dehydrated}.
   *
   * @param selector The selector to query for.
   * @param options Additional options for the query.
   *     `optional` specifies what happens when an element is not found. If
   *         `optional` is `false` (default), an error is thrown. If `optional`
   *         is `true`, then `null` is returned.
   * @returns A {@link Dehydrated} which wraps the query result. Returns `null`
   *     if `optional` is `true` and no element is found.
   * @throws If no element is found and `optional` is `false` (default).
   */
  public query<Query extends string>(
    selector: Query,
    options?: { readonly optional?: false },
  ): QueryResult<Query, El>;
  public query<Query extends string>(
    selector: Query,
    options?: { readonly optional?: boolean },
  ): QueryResult<Query, El> | null;
  public query<Query extends string>(selector: Query, options?: {
    readonly optional?: boolean,
  }): QueryResult<Query, El> | null {
    return this.#root.query(selector, options);
  }

  /**
   * Queries light DOM descendants for the provided selector and returns all
   * matching elements, each wrapped in an {@link Dehydrated}. Always returns a
   * real {@link Array}, not a {@link NodeListOf} like
   * {@link Element.prototype.querySelectorAll}.
   *
   * @param selector The selector to query for.
   * @param options Additional options for the query.
   *     `optional` specifies what happens when no elements are found. If
   *         `optional` is `false` (default), an error is thrown. If `optional`
   *         is `true`, then an empty array is returned.
   * @returns An {@link Array} of the queried elements, each wrapped in an
   *     {@link Dehydrated}.
   * @throws If no element is found and `optional` is `false` (default).
   */
  public queryAll<Selector extends string>(
    selector: Selector,
    options?: { optional?: boolean },
  ): Array<Dehydrated<QueryAllResult<Selector, El>>> {
    return this.#root.queryAll(selector, options);
  }

  public get shadow(): QueryRoot<ShadowRoot> {
    return this.#root.shadow;
  }
}

// An attempt to capture all the event maps a user might reasonably encounter
// in an element discovered by an element query inside a component. Almost
// certainly not exhaustive.
type AllElementsEventMap =
  & HTMLElementEventMap
  & SVGElementEventMap
  & SVGSVGElementEventMap
  & MathMLElementEventMap
  & HTMLVideoElementEventMap
  & HTMLMediaElementEventMap
  & HTMLFrameSetElementEventMap
;
