import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ts from "typescript";

function evaluate(source, globals = {}) {
  const context = { exports: {}, ...globals };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, context);
  return context.exports;
}

const permissions = evaluate(
  await readFile("src/features/messaging/community-permissions.ts", "utf8"),
);
const { canPinCommunityPost, communityCommentsClosed, assertQuestionStatusChange } = permissions;
const question = { authorId: "farmer", category: "question", questionStatus: "open" };
const manager = { id: "manager", roles: ["Management"] };
const farmer = { id: "farmer", roles: ["Farmer"] };

test("Management can pin any category while Marketer retains Announcement pinning", () => {
  for (const category of [
    "question",
    "announcement",
    "farming_tip",
    "marketplace_update",
    "general_discussion",
  ]) {
    assert.equal(canPinCommunityPost(["Management"], category), true);
    assert.equal(canPinCommunityPost(["Marketer"], category), category === "announcement");
    assert.equal(canPinCommunityPost(["Farmer"], category), false);
    assert.equal(canPinCommunityPost(["Accounting"], category), false);
  }
});

test("only Management can resolve Farmer questions or reopen closed questions", () => {
  assert.doesNotThrow(() => assertQuestionStatusChange(manager, question, "resolved"));
  assert.throws(() => assertQuestionStatusChange(farmer, question, "resolved"), /Only Management/);
  assert.doesNotThrow(() => assertQuestionStatusChange(farmer, question, "answered"));
  assert.throws(
    () => assertQuestionStatusChange({ id: "other", roles: ["Marketer"] }, question, "answered"),
    /question author/,
  );
  const closed = { ...question, questionStatus: "resolved" };
  for (const status of ["open", "answered", "resolved"]) {
    assert.throws(() => assertQuestionStatusChange(farmer, closed, status), /Only Management/);
    assert.doesNotThrow(() => assertQuestionStatusChange(manager, closed, status));
  }
});

test("resolved questions close comments while other post types and unanswered questions remain open", () => {
  assert.equal(communityCommentsClosed({ ...question, questionStatus: "resolved" }), true);
  assert.equal(communityCommentsClosed(question), false);
  assert.equal(communityCommentsClosed({ ...question, questionStatus: "answered" }), false);
  assert.equal(
    communityCommentsClosed({ category: "announcement", questionStatus: "resolved" }),
    false,
  );
});

const service = await readFile("src/services/messaging/community-server-functions.ts", "utf8");
const start = service.indexOf("export const postCommunityComment =");
const next = service.indexOf("export const ", start + 1);
const commentHandler = service.slice(start, next < 0 ? undefined : next);

test("the comment handler rechecks the locked post and rejects late comments and replies from every role", async () => {
  for (const roles of [["Farmer"], ["Management"], ["Accounting"], ["Marketer"]]) {
    for (const parentCommentId of [undefined, "parent"]) {
      let inserts = 0;
      let locks = 0;
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({ limit: async () => [] }),
              for: async (mode) => {
                assert.equal(mode, "update");
                locks++;
                return [{ category: "question", questionStatus: "resolved" }];
              },
            }),
          }),
        }),
        transaction: async (callback) => callback(db),
        insert: () => {
          inserts++;
          throw new Error("Closed post accepted an insert");
        },
      };
      const auth = {
        requireAnyRole: async () => ({ id: "member", roles }),
        writeAuditLog: async () => {},
      };
      const { postCommunityComment } = evaluate(commentHandler, {
        createServerFn: () => ({
          validator() {
            return this;
          },
          handler(fn) {
            return fn;
          },
        }),
        commentInput: {},
        communityRoles: roles,
        communityCommentsClosed,
        assertCommunityMessageExists: async () => ({ authorId: "farmer" }),
        assertCommunityCommentExists: async () => ({
          id: "parent",
          messageId: "post",
          parentCommentId: null,
          authorId: "farmer",
        }),
        normalizedMessage: (value) => value.trim(),
        crypto: { randomUUID },
        eq: () => true,
        and: () => true,
        gte: () => true,
        desc: () => true,
        require: (name) => {
          if (name.includes("auth-server")) return auth;
          if (name.includes("client.server")) return { db };
          if (name.includes("db/schema")) return { communityMessages: {}, communityComments: {} };
          throw new Error("Unexpected dependency " + name);
        },
      });
      await assert.rejects(
        postCommunityComment({
          data: { messageId: "post", parentCommentId, message: "late reply" },
        }),
        /Comments and replies are closed/,
      );
      assert.equal(locks, 1);
      assert.equal(inserts, 0);
    }
  }
});
