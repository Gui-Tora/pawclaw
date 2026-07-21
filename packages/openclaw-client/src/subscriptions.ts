export type SubscriptionCallback<T> = (value: T) => void;

export function createSubscription<T>() {
  const listeners = new Set<SubscriptionCallback<T>>();
  return {
    subscribe(callback: SubscriptionCallback<T>) { listeners.add(callback); return () => listeners.delete(callback); },
    publish(value: T) { listeners.forEach((listener) => listener(value)); }
  };
}
