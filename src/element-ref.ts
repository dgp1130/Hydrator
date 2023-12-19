/**
 * @fileoverview Defines the {@link ElementRef} class and associated utilities.
 */

import { type QueriedElement } from './query.js';
import { type AttrSerializer, type Serialized, type Serializable, bigintSerializer, booleanSerializer, numberSerializer, stringSerializer, toSerializer } from './serializers.js';

/**
 * A wrapper class of {@link Element} which provides more ergonomic API access
 * conducive to chaining.
 */
export class ElementRef<El extends Element> {
  private constructor(public readonly native: El) {}

  /**
   * Creates a new {@link ElementRef} from the given {@link Element} object.
   *
   * @param native The native element to wrap in an {@link ElementRef}.
   * @returns A new {@link ElementRef} object wrapping the input.
   */
  public static from<El extends Element>(native: El): ElementRef<El> {
    if (native.nodeType !== Node.ELEMENT_NODE) {
      throw new Error(`Tried to create an \`ElementRef\` of \`nodeType\` ${
        native.nodeType} (see https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType).\n\n\`ElementRef\` must be created with an \`Element\`, not any other type of \`Node\`.`);
    }

    return new ElementRef(native);
  }

  /**
   * Provides the value of the text content on the underlying element.
   *
   * @param token A "token" which identifiers an {@link AttrSerializer} to
   *     deserialize the read attribute string. A token is one of:
   *     *   A primitive serializer - {@link String}, {@link Boolean},
   *         {@link Number}, {@link BigInt}.
   *     *   An {@link AttrSerializer} object.
   *     *   A {@link Serializable} object.
   * @returns The value of the text content for this element deserialized based
   *     on the input token.
   */
  public read<Token extends SerializerToken<any>>(token: Token):
      Serialized<ResolveSerializer<Token>> {
    const text = this.native.textContent;

    // This should only happen when the native element is a `Document` or a
    // DocType. Neither should be allowed to be constructed, but even if so, we
    // assert here to be sure.
    if (text === null) {
      throw new Error('`textContent` was `null`.');
    }

    const serializer = resolveSerializer(token);
    return serializer.deserialize(text) as any;
  }

  /**
   * Provides the value of the attribute with the given name on the underlying
   * element.
   *
   * Note that an attribute without a value such as `<div foo></div>` will
   * return an empty string which is considered falsy. The correct way to check
   * if an attribute exists is: `attr('foo') !== null`.
   *
   * @param name The name of the attribute to read.
   * @param token A "token" which identifiers an {@link AttrSerializer} to
   *     deserialize the read attribute string. A token is one of:
   *     *   A primitive serializer - {@link String}, {@link Boolean},
   *         {@link Number}, {@link BigInt}.
   *     *   An {@link AttrSerializer} object.
   *     *   A {@link Serializable} object.
   * @returns The value of the attribute deserialized based on the input token,
   *     or `null` if not set.
   */
  public attr<Token extends SerializerToken<any>>(
    name: string,
    token: Token,
    options: { optional: true },
  ): Serialized<ResolveSerializer<Token>> | undefined;
  public attr<Token extends SerializerToken<any>>(
    name: string,
    token: Token,
    options?: { optional?: false },
  ): Serialized<ResolveSerializer<Token>>;
  public attr<Token extends SerializerToken<any>>(
    name: string,
    token: Token,
    options?: { optional?: boolean },
  ): Serialized<ResolveSerializer<Token>> | undefined;
  public attr<Token extends SerializerToken<any>>(
    name: string,
    token: Token,
    { optional }: { optional?: boolean } = {},
  ): Serialized<ResolveSerializer<Token>> | undefined {
    const serialized = this.native.getAttribute(name);
    if (serialized === null) {
      if (optional) {
        return undefined;
      } else {
        throw new Error(`Attribute "${name}" did not exist on element. Is the name wrong, or does the attribute not exist? If it is expected that the attribute may not exist, consider calling \`attr\` with \`{ optional: true }\` to ignore this error.`);
      }
    }

    const serializer = resolveSerializer(token);
    return serializer.deserialize(serialized) as any;
  }

  /**
   * Queries light DOM descendants for the provided selector and returns the
   * first matching element wrapped in an {@link ElementRef}. Returns
   * `undefined` if no element is found.
   *
   * @param selector The selector to query for.
   * @returns An {@link ElementRef} which wraps the query result, or `null` if
   *     no element is found.
   */
  public query<Query extends string>(
    selector: Query,
    options?: { readonly optional?: false },
  ): QueryResult<Query, El>;
  public query<Query extends string>(
    selector: Query,
    options: { readonly optional: boolean },
  ): QueryResult<Query, El> | null;
  public query<Query extends string>(selector: Query, { optional = false }: {
    readonly optional?: boolean,
  } = {}): QueryResult<Query, El> | null {
    const child = this.native.querySelector(selector) as
        QueriedElement<Query, El> | null;
    if (!child) {
      if (optional) {
        return null;
      } else {
        throw new Error(`Selector "${selector}" did not resolve to an element. Is the selector wrong, or does the element not exist? If it is expected that the element may not exist, consider calling \`.query('${selector}', { optional: true })\` to ignore this error.`);
      }
    }

    return ElementRef.from(child) as QueryResult<Query, El>;
  }

  /**
   * Queries light DOM descendants for the provided selector and returns all
   * matching elements, each wrapped in an {@link ElementRef}. Always returns a
   * real {@link Array}, not a {@link NodeListOf} like
   * {@link Element.prototype.querySelectorAll}. Returns an empty array when no
   * elements match the given query.
   *
   * @param selector The selector to query for.
   * @returns An {@link Array} of the queried elements, each wrapped in an
   *     {@link ElementRef}.
   */
  public queryAll<Selector extends string>(
    selector: Selector,
    { optional = false }: { optional?: boolean } = {},
  ): Array<ElementRef<QueryAllResult<Selector, El>>> {
    const elements = this.native.querySelectorAll(selector) as
        NodeListOf<QueryAllResult<Selector, El>>;
    if (!optional && elements.length === 0) {
      throw new Error(`Selector "${selector}" did not resolve to any elements. Is the selector wrong, or do the elements not exist? If it is expected that the elements may not exist, consider calling \`.queryAll('${selector}', { optional: true })\` to ignore this error.`);
    }

    return Array.from(elements).map((el) => ElementRef.from(el));
  }
}

// `QueriedElement` returns `null` when given a pseudo-element selector. Need to
// avoid boxing this `null` into `ElementRef<null>`.
type QueryResult<Query extends string, Host extends Element> =
    QueriedElement<Query, Host> extends null
        ? null
        : ElementRef<QueriedElement<Query, Host>>
;

// `QueriedElement` returns `null` when given a pseudo-element selector. Need to
// avoid boxing this `null` into `null[]`, when any such values would be
// filtered out of the result.
type QueryAllResult<Query extends string, Host extends Element> =
    QueriedElement<Query, Host> extends null
        ? Element
        : QueriedElement<Query, Host>
;

// Tokens which reference `Serializer` objects for primitive types, filtered
// down only to those which extend the given input type.
type PrimitiveSerializerToken<Value> =
    | Value extends string ? typeof String : never
    | Value extends number ? typeof Number : never
    | Value extends boolean ? typeof Boolean : never
    | Value extends bigint ? typeof BigInt : never
;

/**
 * Tokens which can be exchanged for an {@link AttrSerializer} object.
 * {@link AttrSerializer} objects are treated as tokens which can be exchanged
 * for themselves.
 */
export type SerializerToken<Value> =
    | PrimitiveSerializerToken<Value>
    | AttrSerializer<Value>
    | Serializable<Value>
;

/**
 * Resolves and returns the {@link AttrSerializer} referenced by the provided
 * token.
 */
export function resolveSerializer<Token extends SerializerToken<any>>(
    token: Token): ResolveSerializer<typeof token> {
  switch (token) {
    case String: {
      return stringSerializer as ResolveSerializer<Token>;
    } case Number: {
      return numberSerializer as ResolveSerializer<Token>;
    } case Boolean: {
      return booleanSerializer as ResolveSerializer<Token>;
    } case BigInt: {
      return bigintSerializer as ResolveSerializer<Token>;
    } default: {
      if (toSerializer in token) {
        return (token as Serializable<unknown>)[toSerializer]() as
            ResolveSerializer<Token>;
      } else {
        // Already a serializer.
        return token as ResolveSerializer<Token>;
      }
    }
  }
}

// Computes the return type of a resolved `Serializer` object for a given token.
export type ResolveSerializer<Token extends SerializerToken<any>> =
    Token extends Serializable<unknown>
        ? ReturnType<Token[typeof toSerializer]>
        : Token extends AttrSerializer<unknown>
            ? Token
            : Token extends typeof String
                ? typeof stringSerializer
                : Token extends typeof Number
                    ? typeof numberSerializer
                    : Token extends typeof Boolean
                        ? typeof booleanSerializer
                        : Token extends typeof BigInt
                            ? typeof bigintSerializer
                            : never
;
