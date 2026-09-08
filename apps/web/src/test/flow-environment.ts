type ResizeCallback = (entries: readonly { target: Element }[]) => void;

class ResizeObserverStub {
  constructor(private readonly notify: ResizeCallback) {}

  observe(target: Element) {
    setTimeout(() => {
      this.notify([{ target }]);
    }, 0);
  }

  unobserve() {}

  disconnect() {}
}

class DOMMatrixStub {
  m22 = 1;

  constructor(readonly transform?: string) {}
}

const define = (name: string, value: unknown) => {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
};

export const installFlowEnvironment = () => {
  define('ResizeObserver', ResizeObserverStub);
  define('DOMMatrixReadOnly', DOMMatrixStub);
  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetWidth: { get: () => 260, configurable: true },
    offsetHeight: { get: () => 200, configurable: true },
  });
  Object.defineProperty(globalThis.SVGElement.prototype, 'getBBox', {
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    writable: true,
    configurable: true,
  });
};
