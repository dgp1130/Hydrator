import { component } from 'hydroactive';
import { bind, live } from 'hydroactive/signal-accessors.js';
import { cached } from 'hydroactive/signals.js';

/** Uses `cached` to avoid repeatedly executing an expensive computed signal. */
export const CachedValue = component('cached-value', (host) => {
  const count = live(host.query('#count').access(), host, Number);
  host.query('button').access().listen(host, 'click', () => {
    count.set(count() + 1);
  });

  // Define a computed with `cached` to cache the result. No matter how many
  // times `pi()` is called, the result will be reused as long as `count` does
  // not change.
  const pi = cached(() => {
    console.log(`Computing PI to ${count()} digits...`);
    return computePiWithPrecision(count());
  });

  // `pi` is read twice here, and both will update automatically, but it will
  // only be computed once.
  bind(host.query('#pi').access(), host, String, () => pi());
  bind(host.query('#pi-again').access(), host, String, () => pi());
});

CachedValue.define();

declare global {
  interface HTMLElementTagNameMap {
    'cached-value': InstanceType<typeof CachedValue>;
  }
}

/**
 * Pretend this is computationally expensive and we don't want to run it more
 * than we need to.
 */
function computePiWithPrecision(precision: number): string {
  const length = '3.'.length + precision;
  return Math.PI.toFixed(48).slice(0, length).padEnd(length, '0');
}
