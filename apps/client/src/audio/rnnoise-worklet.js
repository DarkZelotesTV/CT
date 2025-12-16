import rnnoiseModuleUrl from '@jitsi/rnnoise-wasm/dist/rnnoise-sync.js?url';

const FRAME_SIZE = 480;

let modulePromise = null;

const loadRnnoiseModule = () => {
  if (!modulePromise) {
    modulePromise = new Promise((resolve, reject) => {
      try {
        importScripts(rnnoiseModuleUrl);
        // eslint-disable-next-line no-undef
        if (typeof createRNNWasmModuleSync !== 'function') {
          reject(new Error('RNNoise-WASM konnte nicht geladen werden.'));
          return;
        }
        // eslint-disable-next-line no-undef
        const module = createRNNWasmModuleSync();
        resolve(module);
      } catch (err) {
        reject(err);
      }
    });
  }
  return modulePromise;
};

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.module = null;
    this.state = null;
    this.bufferPtr = 0;
    this.inputBuffer = new Float32Array(FRAME_SIZE);
    this.inputIndex = 0;
    this.outputQueue = [];
    this.ready = false;

    loadRnnoiseModule()
      .then((module) => {
        this.module = module;
        this.state = module._rnnoise_create();
        this.bufferPtr = module._malloc(FRAME_SIZE * 4);
        this.ready = !!(this.state && this.bufferPtr);
        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => {
        this.port.postMessage({ type: 'error', message: err?.message || String(err) });
      });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || output.length === 0) return true;

    const inputChannel = input?.[0];
    const outputChannel = output[0];

    if (!inputChannel || inputChannel.length === 0) {
      outputChannel.fill(0);
      return true;
    }

    if (!this.ready || !this.module) {
      outputChannel.set(inputChannel);
      return true;
    }

    const module = this.module;

    for (let i = 0; i < inputChannel.length; i++) {
      this.inputBuffer[this.inputIndex++] = inputChannel[i];

      if (this.inputIndex === FRAME_SIZE) {
        module.HEAPF32.set(this.inputBuffer, this.bufferPtr / 4);
        module._rnnoise_process_frame(this.state, this.bufferPtr, this.bufferPtr);
        const processed = module.HEAPF32.subarray(this.bufferPtr / 4, this.bufferPtr / 4 + FRAME_SIZE);
        this.outputQueue.push(...processed);
        this.inputIndex = 0;
      }
    }

    for (let i = 0; i < outputChannel.length; i++) {
      if (this.outputQueue.length) {
        outputChannel[i] = this.outputQueue.shift();
      } else {
        outputChannel[i] = inputChannel[i] ?? 0;
      }
    }

    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
