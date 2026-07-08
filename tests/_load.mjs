// Helper de testes — carrega os módulos da extensão (tokenizer/pricing/models)
// num sandbox `vm`, exatamente como o gate (scripts/gate.mjs §6) faz. Zero dependências.
// Não roda no navegador: o objetivo é exercitar a LÓGICA (custo, tokFactor, detecção)
// de forma determinística, sem DOM real. O `document` é um stub opcional para simular
// o texto lido do seletor de modelo em cada site.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'PromptMeter_MVP_Sprint1');

// Carrega tokenizer→pricing→models num contexto novo. A ORDEM importa (pricing usa
// window.PMTokenizer; models usa window.PM_PRICING).
//   opts.documentText — texto que document.querySelector(...).textContent devolverá
//                        (para simular a detecção de modelo pelo DOM).
//   opts.hostname     — location.hostname do sandbox (fallback de resolveModel).
export function loadExtension(opts = {}) {
  const { documentText = null, hostname = '' } = opts;
  const sandbox = {
    window: {},
    location: { hostname },
    console,
    TextEncoder,
    TextDecoder,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    // Stub mínimo de DOM: quando documentText é dado, todo querySelector devolve um
    // "elemento" com esse textContent; caso contrário, nada é encontrado (null).
    document: {
      querySelector: () => (documentText != null ? { textContent: documentText } : null),
    },
  };
  sandbox.window.location = sandbox.location;
  vm.createContext(sandbox);
  for (const f of ['tokenizer.js', 'pricing.js', 'models.js']) {
    vm.runInContext(readFileSync(path.join(EXT, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox.window;
}
