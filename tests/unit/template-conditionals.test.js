import { evaluateExpression } from "../../dist/template/evaluator/index.js";
import { renderTemplate } from "../../dist/template/resolver/resolver.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("template-conditionals: evaluateExpression parses and evaluates boolean logic", () => {
  const data = {
    customer: { isVip: true, age: 30, tier: "gold" },
    active: false,
    score: 85,
  };

  // Identifiers
  assert(evaluateExpression("customer.isVip", data) === true);
  assert(evaluateExpression("active", data) === false);
  assert(evaluateExpression("missing.variable", data) === false);

  // Relational & Equality
  assert(evaluateExpression("customer.tier == 'gold'", data) === true);
  assert(evaluateExpression("customer.tier != 'bronze'", data) === true);
  assert(evaluateExpression("customer.age >= 18", data) === true);
  assert(evaluateExpression("score < 50", data) === false);
  assert(evaluateExpression("score >= 80", data) === true);

  // Logical operators & grouping
  assert(evaluateExpression("customer.isVip && score >= 80", data) === true);
  assert(evaluateExpression("active || customer.isVip", data) === true);
  assert(evaluateExpression("!active", data) === true);
  assert(evaluateExpression("(customer.tier == 'silver' || score > 80) && !active", data) === true);
});

test("template-conditionals: evaluateExpression neutralizes injection attacks safely", () => {
  const data = { a: 1 };

  // Prototype pollution attempts
  assert(evaluateExpression("__proto__.polluted", data) === false);
  assert(evaluateExpression("constructor.prototype", data) === false);

  // Malformed expressions return false without throwing unhandled exceptions
  assert(evaluateExpression("(((malformed &&", data) === false);
  assert(evaluateExpression("", data) === false);
  assert(evaluateExpression("   ", data) === false);
});

test("template-conditionals: renderTemplate prunes conditional blocks according to expression", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push(
    {
      type: "paragraph",
      id: "p_intro",
      children: [{ type: "text", id: "t_intro", text: "Introduction" }],
    },
    {
      type: "conditional",
      id: "cond_vip",
      expression: "customer.isVip",
      children: [
        {
          type: "paragraph",
          id: "p_vip",
          children: [{ type: "text", id: "t_vip", text: "Gold customer priority notice." }],
        },
      ],
      elseChildren: [
        {
          type: "paragraph",
          id: "p_standard",
          children: [{ type: "text", id: "t_std", text: "Standard customer terms apply." }],
        },
      ],
    }
  );

  // Case 1: Truthy evaluation
  const resTrue = renderTemplate(doc, { customer: { isVip: true } });
  const blocksTrue = resTrue.document.root.children;
  assert.equal(blocksTrue.length, 2);
  assert(!blocksTrue.some((b) => b.type === "conditional"), "Conditional wrapper must be pruned");
  assert.equal(blocksTrue[1].id, "p_vip");
  assert(blocksTrue[1].children[0].text.includes("Gold customer"));

  // Case 2: Falsey evaluation
  const resFalse = renderTemplate(doc, { customer: { isVip: false } });
  const blocksFalse = resFalse.document.root.children;
  assert.equal(blocksFalse.length, 2);
  assert(!blocksFalse.some((b) => b.type === "conditional"), "Conditional wrapper must be pruned");
  assert.equal(blocksFalse[1].id, "p_standard");
  assert(blocksFalse[1].children[0].text.includes("Standard customer"));
});

test("template-conditionals: renderTemplate handles inline text conditionals", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      {
        type: "text",
        id: "t1",
        text: "Hello, {{#if isVip}}VIP User{{else}}Standard User{{/if}}! Thank you.",
      },
    ],
  });

  const resTrue = renderTemplate(doc, { isVip: true });
  const textTrue = resTrue.document.root.children[0].children[0].text;
  assert.equal(textTrue, "Hello, VIP User! Thank you.");

  const resFalse = renderTemplate(doc, { isVip: false });
  const textFalse = resFalse.document.root.children[0].children[0].text;
  assert.equal(textFalse, "Hello, Standard User! Thank you.");
});

test("template-conditionals: schema validator verifies conditional block requirements", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "conditional",
    id: "c_valid",
    expression: "user.age >= 18",
    children: [
      {
        type: "paragraph",
        id: "p_sub",
        children: [{ type: "text", id: "t_sub", text: "Adult section" }],
      },
    ],
  });

  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Missing expression
  const badDoc = JSON.parse(JSON.stringify(doc));
  delete badDoc.root.children[0].expression;
  const badRes = validateDocument(badDoc, { strict: true });
  assert(!badRes.valid);
  assert(badRes.errors.some((e) => e.code === "required"));
});
