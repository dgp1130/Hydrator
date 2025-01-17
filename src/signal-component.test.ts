import { type SignalHydrateLifecycle, signalComponent } from './signal-component.js';
import { HydroActiveComponent } from './hydroactive-component.js';
import { SignalComponentAccessor } from './signal-component-accessor.js';
import { ReactiveRootImpl } from './signals/reactive-root.js';
import { TestScheduler } from './signals/schedulers/test-scheduler.js';
import { testCase, useTestCases } from './testing/test-cases.js';
import { parseHtml } from './testing.js';
import { StabilityTracker } from './signals/schedulers/stability-tracker.js';

describe('signal-component', () => {
  useTestCases();

  afterEach(() => {
    for (const child of Array.from(document.body.childNodes)) {
      child.remove();
    }
  });

  describe('signalComponent', () => {
    it('upgrades already rendered components when defined', testCase('already-rendered', () => {
      const hydrate = jasmine.createSpy<SignalHydrateLifecycle<any>>('hydrate');
      const Comp = signalComponent('already-rendered', hydrate);
      Comp.define();

      expect(hydrate).toHaveBeenCalledTimes(1);
    }));

    it('upgrades components rendered after definition', () => {
      const hydrate = jasmine.createSpy<SignalHydrateLifecycle<any>>('hydrate');

      const Comp = signalComponent('new-component', hydrate);
      Comp.define();
      expect(hydrate).not.toHaveBeenCalled();

      const comp = document.createElement('new-component');
      expect(hydrate).not.toHaveBeenCalled();

      document.body.appendChild(comp);
      expect(hydrate).toHaveBeenCalledTimes(1);
    });

    it('invokes hydrate callback without a `this` value', () => {
      // Can't use Jasmine spies here because they will default `this` to `window`
      // because they are run in "sloppy mode".
      let self: unknown = 'defined' /* initial value other than undefined */;
      function hydrate(this: unknown): void {
        self = this;
      }

      const Comp = signalComponent('this-component', hydrate);
      Comp.define();

      const comp = document.createElement('this-component');
      document.body.appendChild(comp);

      expect(self).toBeUndefined();
    });

    it('invokes hydrate callback with a `SignalComponentAccessor` of the component host', () => {
      const hydrate = jasmine.createSpy<SignalHydrateLifecycle<any>>('hydrate');
      const Comp = signalComponent('host-component', hydrate);
      Comp.define();

      const comp =
          document.createElement('host-component') as HydroActiveComponent;
      document.body.appendChild(comp);

      const root = ReactiveRootImpl.from(
          comp._connectable, StabilityTracker.from(), TestScheduler.from());
      const accessor = SignalComponentAccessor.fromSignalComponent(comp, root);
      expect(hydrate).toHaveBeenCalledOnceWith(accessor);
    });

    it('applies the component definition returned by the `hydrate` callback', () => {
      const hydrate = jasmine.createSpy<SignalHydrateLifecycle<any>>('hydrate')
          .and.returnValue({ foo: 'bar' });

      const CompWithDef = signalComponent(
          'signal-comp-with-def', hydrate);

      const el = parseHtml(CompWithDef, `
        <signal-comp-with-def></signal-comp-with-def>
      `);
      document.body.appendChild(el);

      expect(el.foo).toBe('bar');
    });

    it('sets the class name', () => {
      const Comp = signalComponent('foo-bar-baz', () => {});
      expect(Comp.name).toBe('FooBarBaz');
    });
  });
});
