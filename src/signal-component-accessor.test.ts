import './testing/noop-component.js';

import { SignalComponentAccessor } from './signal-component-accessor.js';
import { ReactiveRootImpl } from './signals/reactive-root.js';
import { TestScheduler } from './signals/schedulers/test-scheduler.js';
import { StabilityTracker } from './signals/schedulers/stability-tracker.js';

describe('signal-component-accessor', () => {
  describe('SignalComponentAccessor', () => {
    afterAll(() => {
      for (const el of document.body.children) el.remove();
    });

    describe('fromSignalComponent', () => {
      it('provides a `SignalComponentAccessor`', () => {
        const el = document.createElement('noop-component');
        const root = ReactiveRootImpl.from(
            el._connectable, StabilityTracker.from(), TestScheduler.from());

        expect(SignalComponentAccessor.fromSignalComponent(el, root))
            .toBeInstanceOf(SignalComponentAccessor);
      });
    });

    describe('effect', () => {
      it('schedules an effect on the provided `ReactiveRoot`', () => {
        const el = document.createElement('noop-component');
        document.body.append(el);

        const tracker = StabilityTracker.from();
        const scheduler = TestScheduler.from();
        const root = ReactiveRootImpl.from(
            el._connectable, tracker, scheduler);

        const effect = jasmine.createSpy<() => void>('effect');

        root.effect(effect);
        expect(tracker.isStable()).toBeFalse();
        expect(effect).not.toHaveBeenCalled();

        scheduler.flush();
        expect(effect).toHaveBeenCalledOnceWith();
      });

      it('schedules an effect with the provided scheduler', () => {
        const el = document.createElement('noop-component');
        document.body.append(el);

        const tracker = StabilityTracker.from();
        const defaultScheduler = TestScheduler.from();
        const root = ReactiveRootImpl.from(
            el._connectable, tracker, defaultScheduler);

        const effect = jasmine.createSpy<() => void>('effect');
        const customScheduler = TestScheduler.from();

        root.effect(effect, customScheduler);
        expect(effect).not.toHaveBeenCalled();

        defaultScheduler.flush(); // Default scheduler does nothing.
        expect(effect).not.toHaveBeenCalled();

        customScheduler.flush(); // Custom scheduler triggers effect.
        expect(effect).toHaveBeenCalled();
      });
    });
  });
});
