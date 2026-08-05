/**
 * Testes da função pura targetIsGone — predicado do "card fantasma" (issue #69).
 * Zero dependências. Uso: node --test tests/*.test.mjs (ou via node scripts/gate.mjs)
 *
 * Importa content.js como CommonJS (mesmo caminho de session-footer.test.mjs): o arquivo é
 * um content script (IIFE) com guardas inertes que impedem seus efeitos colaterais em Node.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { targetIsGone } = require(
  path.join(HERE, "..", "PromptMeter_MVP_Sprint1", "content.js")
);

// Stub mínimo de document: contains() responde pela lista de nós "vivos".
const docWith = (...vivos) => ({ contains: (n) => vivos.includes(n) });
const campo = { tag: "textarea" };

test("campo removido do DOM: gone (é o caso do card fantasma ao trocar de conversa)", () => {
  assert.equal(targetIsGone(campo, docWith()), true);
});

test("campo ainda no DOM: não é gone (o card não pode sumir com o usuário digitando)", () => {
  assert.equal(targetIsGone(campo, docWith(campo)), false);
});

test("sem alvo ativo: não é gone (nada a esconder)", () => {
  assert.equal(targetIsGone(null, docWith()), false);
  assert.equal(targetIsGone(undefined, docWith()), false);
});

test("document ausente ou sem contains: NÃO afirma gone — na dúvida o card fica", () => {
  assert.equal(targetIsGone(campo, null), false);
  assert.equal(targetIsGone(campo, undefined), false);
  assert.equal(targetIsGone(campo, {}), false);
  assert.equal(targetIsGone(campo, { contains: "nao-e-funcao" }), false);
});

test("é pura: não muta nem o alvo nem o document", () => {
  const alvo = { tag: "div" };
  const doc = docWith(alvo);
  targetIsGone(alvo, doc);
  assert.deepEqual(alvo, { tag: "div" });
  assert.equal(typeof doc.contains, "function");
});
