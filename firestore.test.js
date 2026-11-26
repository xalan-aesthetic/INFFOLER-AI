const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_uid_123";
const BOB_UID = "bob_uid_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated users cannot read or write profiles, chats, messages, or simulations", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const past = new Date(Date.now() - 2000);

  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID,
      displayName: "Hacker",
      createdAt: past,
      updatedAt: past,
    })
  );
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("chats").get());
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("simulations").get());
});

test("User profile creation, valid update, ghost-field rejection, and cross-user isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const created = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID,
      displayName: "Alankrit User",
      email: "alice@example.com",
      photoURL: "https://example.com/a.png",
      theme: "dark",
      preferredModel: "gemini-2.5-flash",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Valid partial update
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      displayName: "Alankrit Updated",
      theme: "light",
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  // Reject immutable createdAt mutation
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      createdAt: new Date(Date.now() - 500),
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // Reject ghost admin field
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      isAdmin: true,
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // Reject user enumeration (list) and cross-user read/write
  await assertFails(bobDb.collection("users").get());
  await assertFails(bobDb.collection("users").doc(ALICE_UID).get());
  await assertFails(bobDb.collection("users").doc(ALICE_UID).delete());
});

test("Personal chats and messages lifecycle + cross-user denial", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const t0 = new Date(Date.now() - 8000);

  const chatRef = aliceDb.collection("users").doc(ALICE_UID).collection("chats").doc("chat_001");
  await assertSucceeds(
    chatRef.set({
      userId: ALICE_UID,
      title: "Quantum Computing",
      modelId: "gemini-2.5-flash",
      isSaved: false,
      messageCount: 1,
      lastMessagePreview: "Explain qubits simply",
      createdAt: t0,
      updatedAt: t0,
    })
  );

  // Rename & save chat
  await assertSucceeds(
    chatRef.update({
      title: "Quantum Computing Notes",
      isSaved: true,
      updatedAt: new Date(Date.now() - 2000),
    })
  );

  // Add message
  const msgRef = chatRef.collection("messages").doc("msg_001");
  await assertSucceeds(
    msgRef.set({
      userId: ALICE_UID,
      role: "model",
      text: "A qubit can exist in a superposition of 0 and 1.",
      modelId: "gemini-2.5-flash",
      hasImage: false,
      feedback: "none",
      createdAt: t0,
    })
  );

  // Update feedback only
  await assertSucceeds(msgRef.update({ feedback: "up" }));

  // Reject tampering message text on update
  await assertFails(msgRef.update({ text: "Tampered text" }));

  // List own chats & messages
  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).collection("chats").get());
  await assertSucceeds(chatRef.collection("messages").get());

  // Cross-user isolation
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("chats").get());
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("chats").doc("chat_001").delete()
  );
  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("chats")
      .doc("chat_001")
      .collection("messages")
      .get()
  );
});

test("WHAT IF simulations create, list, delete, and immutability", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const t0 = new Date(Date.now() - 4000);

  const simRef = aliceDb.collection("users").doc(ALICE_UID).collection("simulations").doc("sim_001");
  await assertSucceeds(
    simRef.set({
      userId: ALICE_UID,
      question: "What if gravity dropped 20%?",
      initialScenario: "Initial",
      immediateConsequences: "Immediate",
      shortTermPossibilities: "Short",
      longTermPossibilities: "Long",
      alternativeOutcomes: "Alt",
      factsVsSpeculation: "Facts",
      createdAt: t0,
    })
  );

  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).collection("simulations").get());
  await assertFails(simRef.update({ question: "Changed" }));
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("simulations").get());
  await assertSucceeds(simRef.delete());
});
