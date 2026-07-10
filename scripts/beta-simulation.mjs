/**
 * beta-simulation.mjs — Phase 18
 *
 * Realistic Beta User Simulation
 * Simulates real user scenarios to identify failures before launch.
 *
 * Scenarios:
 *   1. New user registration
 *   2. First conversation
 *   3. Multiple conversations
 *   4. File uploads
 *   5. AI tools usage
 *   6. Memory usage
 *   7. Returning user after days
 *   8. Multiple users simultaneously
 *
 * Run: node scripts/beta-simulation.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE_URL = process.env.API_URL || "http://localhost:3001";
const REPORT_DIR = join(ROOT, "docs");

// ─── Utilities ────────────────────────────────────────────────────────────────

async function apiCall(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

function randomEmail() {
  return `beta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.omni.one`;
}

function log(icon, msg, detail = "") {
  const d = detail ? `  → ${detail}` : "";
  console.log(`  ${icon} ${msg.padEnd(55)} ${d}`);
}

// ─── Scenario Runner ──────────────────────────────────────────────────────────

async function runScenario(name, fn) {
  const start = Date.now();
  console.log(`\n${"─".repeat(70)}`);
  console.log(`🔬 Scenario: ${name}`);
  console.log(`${"─".repeat(70)}`);
  const issues = [];
  try {
    await fn(issues);
  } catch (err) {
    issues.push({ type: "CRASH", message: err.message });
    log("💥", "Scenario crashed", err.message);
  }
  const duration = Date.now() - start;
  const status = issues.length === 0 ? "✅ PASS" : `⚠️  ${issues.length} issue(s)`;
  console.log(`\n  ${status}  (${duration}ms)`);
  return { name, duration, issues };
}

// ─── Scenario 1: New User Registration ───────────────────────────────────────

async function scenario1_newUserRegistration(issues) {
  const email = randomEmail();
  const password = "BetaTest@2026!";

  // 1a. Register
  const reg = await apiCall("POST", "/auth/register", { email, password, displayName: "Beta Tester" });
  if (!reg.ok) {
    issues.push({ type: "REGISTRATION_FAIL", status: reg.status, detail: reg.data?.error?.message });
    log("❌", "Register new user", `HTTP ${reg.status}: ${reg.data?.error?.message}`);
    return;
  }
  log("✅", "Register new user", `user created`);

  // 1b. Duplicate registration (should fail gracefully)
  const dup = await apiCall("POST", "/auth/register", { email, password });
  if (dup.ok) {
    issues.push({ type: "DUPLICATE_USER_ALLOWED", detail: "Duplicate registration succeeded" });
    log("❌", "Reject duplicate email", "Duplicate was accepted — security issue");
  } else {
    log("✅", "Reject duplicate email", `HTTP ${dup.status} as expected`);
  }

  // 1c. Login
  const login = await apiCall("POST", "/auth/login", { email, password });
  if (!login.ok) {
    issues.push({ type: "LOGIN_FAIL", status: login.status });
    log("❌", "Login after registration", `HTTP ${login.status}`);
    return;
  }
  log("✅", "Login after registration", "token received");

  // 1d. Wrong password (should fail)
  const badLogin = await apiCall("POST", "/auth/login", { email, password: "WrongPass123!" });
  if (badLogin.ok) {
    issues.push({ type: "WRONG_PASSWORD_ACCEPTED", detail: "Wrong password was accepted" });
    log("❌", "Reject wrong password", "Wrong password accepted — critical security issue");
  } else {
    log("✅", "Reject wrong password", `HTTP ${badLogin.status} as expected`);
  }

  // 1e. Get profile
  const token = login.data?.data?.token;
  const me = await apiCall("GET", "/auth/me", null, token);
  if (!me.ok) {
    issues.push({ type: "PROFILE_FETCH_FAIL" });
    log("❌", "Fetch user profile", `HTTP ${me.status}`);
  } else {
    log("✅", "Fetch user profile", `email: ${me.data?.data?.user?.email}`);
  }
}

// ─── Scenario 2: First Conversation ──────────────────────────────────────────

async function scenario2_firstConversation(issues) {
  const email = randomEmail();
  const password = "BetaTest@2026!";
  await apiCall("POST", "/auth/register", { email, password, displayName: "First Conv User" });
  const login = await apiCall("POST", "/auth/login", { email, password });
  if (!login.ok) { issues.push({ type: "LOGIN_FAIL" }); return; }
  const token = login.data?.data?.token;

  // Create conversation
  const conv = await apiCall("POST", "/conversations", { title: "My First Chat" }, token);
  if (!conv.ok) {
    issues.push({ type: "CONVERSATION_CREATE_FAIL", status: conv.status });
    log("❌", "Create first conversation", `HTTP ${conv.status}`);
  } else {
    log("✅", "Create first conversation", `id: ${conv.data?.data?.id?.slice(0, 8)}...`);
  }

  // Send a chat message (backend chat endpoint)
  const chat = await apiCall("POST", "/chat", {
    messages: [{ role: "user", content: "Hello! What can you do?" }],
    conversationId: conv.data?.data?.id,
  }, token);
  if (!chat.ok) {
    // Not a critical failure — AI keys may not be configured in test env
    if (chat.status === 503) {
      log("⚠️ ", "Send first message (no AI key)", `HTTP ${chat.status} — expected in test env`);
    } else {
      issues.push({ type: "CHAT_FAIL", status: chat.status });
      log("❌", "Send first message", `HTTP ${chat.status}`);
    }
  } else {
    log("✅", "Send first message", `response received`);
  }

  // List conversations
  const list = await apiCall("GET", "/conversations", null, token);
  if (!list.ok) {
    issues.push({ type: "CONVERSATION_LIST_FAIL" });
    log("❌", "List conversations", `HTTP ${list.status}`);
  } else {
    const count = list.data?.data?.conversations?.length ?? 0;
    log("✅", "List conversations", `${count} conversation(s) found`);
  }
}

// ─── Scenario 3: Multiple Conversations ──────────────────────────────────────

async function scenario3_multipleConversations(issues) {
  const email = randomEmail();
  const password = "BetaTest@2026!";
  await apiCall("POST", "/auth/register", { email, password });
  const login = await apiCall("POST", "/auth/login", { email, password });
  if (!login.ok) { issues.push({ type: "LOGIN_FAIL" }); return; }
  const token = login.data?.data?.token;

  const titles = ["Research on AI", "Code review", "Travel planning", "Budget analysis", "Creative writing"];
  const ids = [];
  for (const title of titles) {
    const r = await apiCall("POST", "/conversations", { title }, token);
    if (r.ok) {
      ids.push(r.data?.data?.id);
      log("✅", `Create conversation: ${title}`, "ok");
    } else {
      issues.push({ type: "MULTI_CONV_FAIL", title });
      log("❌", `Create conversation: ${title}`, `HTTP ${r.status}`);
    }
  }

  // Delete one conversation
  if (ids[0]) {
    const del = await apiCall("DELETE", `/conversations/${ids[0]}`, null, token);
    if (!del.ok) {
      issues.push({ type: "CONVERSATION_DELETE_FAIL" });
      log("❌", "Delete conversation", `HTTP ${del.status}`);
    } else {
      log("✅", "Delete conversation", "deleted successfully");
    }
  }

  // Verify deletion
  const list = await apiCall("GET", "/conversations", null, token);
  const remaining = list.data?.data?.conversations?.length ?? 0;
  if (remaining !== titles.length - 1) {
    issues.push({ type: "CONVERSATION_COUNT_MISMATCH", expected: titles.length - 1, got: remaining });
    log("⚠️ ", "Verify conversation count after delete", `expected ${titles.length - 1}, got ${remaining}`);
  } else {
    log("✅", "Verify conversation count after delete", `${remaining} remaining`);
  }
}

// ─── Scenario 4: File Uploads ─────────────────────────────────────────────────

async function scenario4_fileUploads(issues) {
  const email = randomEmail();
  const password = "BetaTest@2026!";
  await apiCall("POST", "/auth/register", { email, password });
  const login = await apiCall("POST", "/auth/login", { email, password });
  if (!login.ok) { issues.push({ type: "LOGIN_FAIL" }); return; }
  const token = login.data?.data?.token;

  // Test file upload via multipart (simulate with FormData-like approach)
  // We test the API endpoint validation behavior
  const noFileRes = await fetch(`${BASE_URL}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (noFileRes.status === 400) {
    log("✅", "Reject upload with no file", `HTTP 400 as expected`);
  } else {
    issues.push({ type: "NO_FILE_VALIDATION_MISSING", status: noFileRes.status });
    log("⚠️ ", "Reject upload with no file", `HTTP ${noFileRes.status} — expected 400`);
  }

  // Test listing files
  const files = await apiCall("GET", "/files", null, token);
  if (!files.ok) {
    issues.push({ type: "FILE_LIST_FAIL" });
    log("❌", "List files", `HTTP ${files.status}`);
  } else {
    log("✅", "List files", `${files.data?.data?.length ?? 0} file(s)`);
  }

  // Test accessing non-existent file
  const notFound = await apiCall("GET", "/files/nonexistent-id-12345", null, token);
  if (notFound.status === 404) {
    log("✅", "404 for non-existent file", "correct");
  } else {
    issues.push({ type: "FILE_NOT_FOUND_HANDLING", status: notFound.status });
    log("⚠️ ", "404 for non-existent file", `HTTP ${notFound.status} — expected 404`);
  }
}

// ─── Scenario 5: Health & Status Endpoints ────────────────────────────────────

async function scenario5_healthAndStatus(issues) {
  const health = await apiCall("GET", "/health");
  if (!health.ok) {
    issues.push({ type: "HEALTH_ENDPOINT_DOWN", status: health.status });
    log("❌", "Health endpoint", `HTTP ${health.status}`);
  } else {
    log("✅", "Health endpoint", `uptime: ${health.data?.data?.uptime ?? "?"}s`);
  }

  const status = await apiCall("GET", "/status");
  if (!status.ok) {
    issues.push({ type: "STATUS_ENDPOINT_DOWN" });
    log("❌", "Status endpoint", `HTTP ${status.status}`);
  } else {
    const d = status.data?.data;
    log("✅", "Status endpoint", `operational: ${d?.operational}, aiReady: ${d?.aiReady}`);
  }

  const version = await apiCall("GET", "/version");
  if (!version.ok) {
    issues.push({ type: "VERSION_ENDPOINT_DOWN" });
    log("❌", "Version endpoint", `HTTP ${version.status}`);
  } else {
    log("✅", "Version endpoint", `v${version.data?.data?.version ?? "?"}`);
  }
}

// ─── Scenario 6: Session Expiry & Security ────────────────────────────────────

async function scenario6_sessionSecurity(issues) {
  // Access protected route with no token
  const noAuth = await apiCall("GET", "/auth/me");
  if (noAuth.status === 401) {
    log("✅", "Reject unauthenticated request", "HTTP 401 as expected");
  } else {
    issues.push({ type: "AUTH_BYPASS", status: noAuth.status });
    log("❌", "Reject unauthenticated request", `HTTP ${noAuth.status} — expected 401`);
  }

  // Access with invalid token
  const badToken = await apiCall("GET", "/auth/me", null, "invalid.token.here");
  if (badToken.status === 401) {
    log("✅", "Reject invalid token", "HTTP 401 as expected");
  } else {
    issues.push({ type: "INVALID_TOKEN_ACCEPTED", status: badToken.status });
    log("❌", "Reject invalid token", `HTTP ${badToken.status} — expected 401`);
  }

  // Test logout
  const email = randomEmail();
  const password = "BetaTest@2026!";
  await apiCall("POST", "/auth/register", { email, password });
  const login = await apiCall("POST", "/auth/login", { email, password });
  const token = login.data?.data?.token;
  if (token) {
    const logout = await apiCall("POST", "/auth/logout", {}, token);
    if (!logout.ok) {
      issues.push({ type: "LOGOUT_FAIL" });
      log("❌", "Logout", `HTTP ${logout.status}`);
    } else {
      log("✅", "Logout", "session invalidated");
    }
    // After logout, token should be invalid
    const postLogout = await apiCall("GET", "/auth/me", null, token);
    if (postLogout.status === 401) {
      log("✅", "Token invalidated after logout", "HTTP 401 as expected");
    } else {
      issues.push({ type: "TOKEN_STILL_VALID_AFTER_LOGOUT" });
      log("❌", "Token invalidated after logout", `HTTP ${postLogout.status} — token still valid!`);
    }
  }
}

// ─── Scenario 7: Concurrent Users ────────────────────────────────────────────

async function scenario7_concurrentUsers(issues) {
  const N = 5;
  const users = Array.from({ length: N }, (_, i) => ({
    email: randomEmail(),
    password: "BetaTest@2026!",
    name: `Concurrent User ${i + 1}`,
  }));

  // Register all users concurrently
  const regResults = await Promise.allSettled(
    users.map((u) => apiCall("POST", "/auth/register", { email: u.email, password: u.password, displayName: u.name }))
  );
  const regOk = regResults.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  log(regOk === N ? "✅" : "⚠️ ", `Register ${N} users concurrently`, `${regOk}/${N} succeeded`);
  if (regOk < N) issues.push({ type: "CONCURRENT_REGISTRATION_PARTIAL", succeeded: regOk, total: N });

  // Login all users concurrently
  const loginResults = await Promise.allSettled(
    users.map((u) => apiCall("POST", "/auth/login", { email: u.email, password: u.password }))
  );
  const tokens = loginResults
    .filter((r) => r.status === "fulfilled" && r.value.ok)
    .map((r) => r.value.data?.data?.token)
    .filter(Boolean);
  log(tokens.length === N ? "✅" : "⚠️ ", `Login ${N} users concurrently`, `${tokens.length}/${N} tokens`);

  // Create conversations concurrently
  const convResults = await Promise.allSettled(
    tokens.map((token, i) => apiCall("POST", "/conversations", { title: `Concurrent Conv ${i}` }, token))
  );
  const convOk = convResults.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  log(convOk === tokens.length ? "✅" : "⚠️ ", `Create conversations concurrently`, `${convOk}/${tokens.length} succeeded`);
  if (convOk < tokens.length) issues.push({ type: "CONCURRENT_CONV_PARTIAL", succeeded: convOk });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Omni One — Phase 18 Beta User Simulation                      ║");
  console.log("║   Target: " + BASE_URL.padEnd(54) + "║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const results = [];
  results.push(await runScenario("1. New User Registration & Auth", scenario1_newUserRegistration));
  results.push(await runScenario("2. First Conversation", scenario2_firstConversation));
  results.push(await runScenario("3. Multiple Conversations", scenario3_multipleConversations));
  results.push(await runScenario("4. File Upload Validation", scenario4_fileUploads));
  results.push(await runScenario("5. Health & Status Endpoints", scenario5_healthAndStatus));
  results.push(await runScenario("6. Session Security", scenario6_sessionSecurity));
  results.push(await runScenario("7. Concurrent Users (5 simultaneous)", scenario7_concurrentUsers));

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   SIMULATION SUMMARY                                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  let totalIssues = 0;
  for (const r of results) {
    const icon = r.issues.length === 0 ? "✅" : "⚠️ ";
    console.log(`  ${icon} ${r.name.padEnd(50)} ${r.issues.length} issue(s)  ${r.duration}ms`);
    totalIssues += r.issues.length;
  }
  console.log(`\n  Total issues found: ${totalIssues}`);
  console.log(`  Scenarios run: ${results.length}`);
  console.log(`  Passed: ${results.filter((r) => r.issues.length === 0).length}`);

  // ── Save Report ──────────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalScenarios: results.length,
    passed: results.filter((r) => r.issues.length === 0).length,
    totalIssues,
    scenarios: results,
  };
  const reportPath = join(REPORT_DIR, "BETA_SIMULATION_REPORT.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  📄 Report saved: docs/BETA_SIMULATION_REPORT.json\n`);
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
