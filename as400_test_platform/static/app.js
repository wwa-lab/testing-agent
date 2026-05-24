const state = {
  environments: [],
  cases: [],
  collections: [],
  reports: [],
  latestReport: null,
  selectedProtocol: "TCP",
  selectedCaseId: null,
  selectedCollectionId: null,
  workbenchResult: null,
};

const sampleCollection = {
  name: "AS400 Demo Regression Pack",
  description: "Demo-ready REST, TCP/IP, MQ and DB mock tests for AS400 transaction automation.",
  test_cases: [
    {
      name: "REST - Platform Health Check",
      tags: ["rest", "smoke"],
      request: {
        protocol: "REST",
        rest: {
          method: "GET",
          url: "{{platform_base_url}}/health",
          timeout_seconds: 10,
        },
      },
      validations: [
        {
          name: "HTTP status is 200",
          source: "status_code",
          operator: "equals",
          expected: 200,
        },
      ],
    },
    {
      name: "REST - Authorization Inquiry Mock",
      tags: ["rest", "authorization", "mock"],
      request: {
        protocol: "REST",
        rest: {
          method: "GET",
          url: "{{platform_base_url}}/health",
          timeout_seconds: 10,
        },
      },
      validations: [
        {
          name: "Inquiry service responds",
          source: "json",
          path: "$.status",
          operator: "equals",
          expected: "OK",
        },
      ],
    },
    {
      name: "TCP/IP - Authorization Approved",
      tags: ["tcp", "authorization", "approval", "mock"],
      request: {
        protocol: "TCP",
        tcp: {
          host: "{{as400_host}}",
          port: 9001,
          encoding: "ebcdic",
          response_encoding: "ebcdic",
          payload: "AUTH|TXN10001|CARD411111******1111|100.00|USD",
          timeout_seconds: 30,
          read_bytes: 4096,
          mock_response: "AUTHRESP|TXN10001|APPROVED|00|APPR123456|BALANCE_OK",
          mock_response_time_ms: 21,
        },
      },
      validations: [
        {
          name: "Authorization approved",
          source: "text",
          operator: "contains",
          expected: "APPROVED",
        },
        {
          name: "Response code is 00",
          source: "text",
          operator: "contains",
          expected: "|00|",
        },
        {
          name: "TCP response under SLA",
          source: "response_time_ms",
          operator: "less_than",
          expected: 500,
        },
      ],
    },
    {
      name: "TCP/IP - Authorization Declined",
      tags: ["tcp", "authorization", "negative", "mock"],
      request: {
        protocol: "TCP",
        tcp: {
          host: "{{as400_host}}",
          port: 9001,
          encoding: "ebcdic",
          response_encoding: "ebcdic",
          payload: "AUTH|TXN10002|CARD400000******0002|9000.00|USD",
          timeout_seconds: 30,
          read_bytes: 4096,
          mock_response: "AUTHRESP|TXN10002|DECLINED|51|NO_SUFFICIENT_FUNDS",
          mock_response_time_ms: 28,
        },
      },
      validations: [
        {
          name: "Authorization declined",
          source: "text",
          operator: "contains",
          expected: "DECLINED",
        },
        {
          name: "Decline reason is insufficient funds",
          source: "text",
          operator: "contains",
          expected: "NO_SUFFICIENT_FUNDS",
        },
      ],
    },
    {
      name: "MQ - Settlement Template",
      tags: ["mq", "settlement"],
      request: {
        protocol: "MQ",
        mq: {
          queue_manager: "QM1",
          channel: "DEV.APP.SVRCONN",
          host: "{{mq_host}}",
          port: 1414,
          request_queue: "DEV.REQUEST",
          response_queue: "DEV.RESPONSE",
          payload: "{\"transactionId\":\"T10001\",\"amount\":100}",
          correlation_id: "T10001",
          simulate: true,
        },
      },
      validations: [
        {
          name: "Correlation ID exists",
          source: "mqmd",
          path: "correlation_id",
          operator: "exists",
        },
      ],
    },
    {
      name: "MQ - Fraud Event Mock",
      tags: ["mq", "fraud", "event", "mock"],
      request: {
        protocol: "MQ",
        mq: {
          queue_manager: "QM1",
          channel: "DEV.APP.SVRCONN",
          host: "{{mq_host}}",
          port: 1414,
          request_queue: "FRAUD.EVENT.REQUEST",
          response_queue: "FRAUD.EVENT.RESPONSE",
          payload: "{\"transactionId\":\"TXN10002\",\"riskScore\":92,\"action\":\"REVIEW\"}",
          correlation_id: "TXN10002",
          simulate: true,
        },
      },
      validations: [
        {
          name: "Fraud event correlation exists",
          source: "mqmd",
          path: "correlation_id",
          operator: "equals",
          expected: "TXN10002",
        },
      ],
    },
    {
      name: "DB - Authorization Posted",
      tags: ["db", "backend", "authorization", "mock"],
      request: {
        protocol: "DB",
        db: {
          driver: "sqlite",
          connection: "data/backend_validation.sqlite3",
          query: "select transaction_id, status, response_code, amount from authorization_result where transaction_id = ?",
          parameters: ["TXN10001"],
          mock_rows: [
            {
              transaction_id: "TXN10001",
              status: "POSTED",
              response_code: "00",
              amount: 100,
            },
          ],
        },
      },
      validations: [
        {
          name: "Backend row exists",
          source: "db",
          path: "row_count",
          operator: "equals",
          expected: 1,
        },
        {
          name: "Backend status is posted",
          source: "db",
          path: "rows.0.status",
          operator: "equals",
          expected: "POSTED",
        },
      ],
    },
  ],
  scenarios: [
    {
      name: "Scenario - Full Approved Authorization Flow",
      description: "REST readiness, TCP/IP authorization, MQ settlement event and backend validation.",
      tags: ["scenario", "authorization", "happy-path"],
      steps: [
        {
          name: "Check API gateway health",
          inline_case: {
            name: "REST Step - Gateway Health",
            request: {
              protocol: "REST",
              rest: {
                method: "GET",
                url: "{{platform_base_url}}/health",
                timeout_seconds: 10,
              },
            },
            validations: [
              {
                name: "Gateway is online",
                source: "json",
                path: "$.status",
                operator: "equals",
                expected: "OK",
              },
            ],
          },
        },
        {
          name: "Submit TCP/IP authorization",
          inline_case: {
            name: "TCP Step - Authorization Approved",
            request: {
              protocol: "TCP",
              tcp: {
                host: "{{as400_host}}",
                port: 9001,
                payload: "AUTH|TXN10001|CARD411111******1111|100.00|USD",
                encoding: "ebcdic",
                response_encoding: "ebcdic",
                mock_response: "AUTHRESP|TXN10001|APPROVED|00|APPR123456",
                mock_response_time_ms: 21,
              },
            },
            validations: [
              {
                name: "TCP approval returned",
                source: "text",
                operator: "contains",
                expected: "APPROVED",
              },
            ],
          },
        },
        {
          name: "Publish settlement MQ event",
          inline_case: {
            name: "MQ Step - Settlement Event",
            request: {
              protocol: "MQ",
              mq: {
                queue_manager: "QM1",
                request_queue: "SETTLEMENT.REQUEST",
                response_queue: "SETTLEMENT.RESPONSE",
                payload: "{\"transactionId\":\"TXN10001\",\"status\":\"READY_FOR_SETTLEMENT\"}",
                correlation_id: "TXN10001",
                simulate: true,
              },
            },
            validations: [
              {
                name: "Settlement correlation matches",
                source: "mqmd",
                path: "correlation_id",
                operator: "equals",
                expected: "TXN10001",
              },
            ],
          },
        },
        {
          name: "Validate backend posting",
          inline_case: {
            name: "DB Step - Backend Posted",
            request: {
              protocol: "DB",
              db: {
                driver: "sqlite",
                connection: "data/backend_validation.sqlite3",
                query: "select status from authorization_result where transaction_id = ?",
                parameters: ["TXN10001"],
                mock_rows: [
                  {
                    transaction_id: "TXN10001",
                    status: "POSTED",
                    response_code: "00",
                  },
                ],
              },
            },
            validations: [
              {
                name: "Backend status posted",
                source: "db",
                path: "rows.0.status",
                operator: "equals",
                expected: "POSTED",
              },
            ],
          },
        },
      ],
    },
  ],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindAdminTabs();
  bindActions();
  $("#envVariables").value = JSON.stringify(defaultEnvironmentVariables(), null, 2);
  renderSampleSuiteSelect();
  $("#collectionJson").value = JSON.stringify(buildStarterCollections()[1], null, 2);
  $("#testCaseJson").value = JSON.stringify(sampleCollection.test_cases[0], null, 2);
  refreshAll();
});

function bindNavigation() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-item").forEach((item) => item.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      $(`#view-${button.dataset.view}`).classList.add("active");
      $("#pageTitle").textContent = button.textContent;
    });
  });
}

function bindAdminTabs() {
  $$(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".admin-tab").forEach((item) => item.classList.remove("active"));
      $$(".admin-section").forEach((section) => section.classList.remove("active"));
      button.classList.add("active");
      $(`#admin-${button.dataset.admin}`).classList.add("active");
    });
  });
}

function bindActions() {
  $("#refreshButton").addEventListener("click", refreshAll);
  $("#refreshReportsButton").addEventListener("click", refreshAll);
  $("#runCollectionButton").addEventListener("click", runSelectedCollection);
  $("#runCaseButton").addEventListener("click", runSelectedCase);
  $("#runWorkbenchCaseButton").addEventListener("click", runWorkbenchCase);
  $("#saveWorkbenchCaseButton").addEventListener("click", saveWorkbenchCase);
  $("#importSuiteButton").addEventListener("click", () => $("#suiteFileInput").click());
  $("#exportSuiteButton").addEventListener("click", exportSelectedSuite);
  $("#suiteFileInput").addEventListener("change", importSuiteFromFile);
  $("#saveSuiteButton").addEventListener("click", saveSelectedSuite);
  $("#saveEnvironmentButton").addEventListener("click", saveEnvironment);
  $("#createStarterButton").addEventListener("click", createStarterSetup);
  $("#saveCollectionButton").addEventListener("click", saveCollection);
  $("#saveCaseButton").addEventListener("click", saveCase);
  $("#loadSampleButton").addEventListener("click", () => {
    const collection = selectedSampleSuite();
    $("#collectionJson").value = JSON.stringify(collection, null, 2);
    toast(`${collection.name} loaded into editor.`);
  });
  $("#sampleSuiteSelect").addEventListener("change", () => {
    $("#collectionJson").value = JSON.stringify(selectedSampleSuite(), null, 2);
  });
  $$(".protocol-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".protocol-tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.selectedProtocol = button.dataset.protocol;
      renderRunSelectors();
    });
  });
  $("#collectionSelect").addEventListener("change", renderCollectionSummary);
  $("#caseSelect").addEventListener("change", renderCaseSummary);
  $("#globalEnvironment").addEventListener("change", renderRunReadiness);
  $("#librarySearch").addEventListener("input", renderLibrary);
  $("#libraryProtocol").addEventListener("change", renderLibrary);
  $$(".workbench-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".workbench-tab").forEach((item) => item.classList.remove("active"));
      $$(".workbench-panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $(`#workbench-${button.dataset.workbench}`).classList.add("active");
    });
  });
}

async function refreshAll() {
  await checkHealth();
  const [environments, cases, collections, reports] = await Promise.all([
    api("/environments"),
    api("/test-cases"),
    api("/collections"),
    api("/reports"),
  ]);
  state.environments = environments;
  state.cases = cases;
  state.collections = collections;
  state.reports = reports;
  renderEnvironmentSelect();
  renderRunSelectors();
  renderWorkspaceMetrics();
  renderProtocolCoverage();
  renderLibrary();
  renderSuiteEditor();
  renderWorkbench();
  renderReports();
}

async function checkHealth() {
  try {
    await api("/health");
    $("#healthDot").className = "status-dot ok";
    $("#healthText").textContent = "API online";
  } catch (error) {
    $("#healthDot").className = "status-dot error";
    $("#healthText").textContent = "API unavailable";
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return response.json();
}

function renderEnvironmentSelect() {
  const select = $("#globalEnvironment");
  select.innerHTML = "";
  if (!state.environments.length) {
    select.append(new Option("No environment", ""));
    return;
  }
  state.environments.forEach((env) => select.append(new Option(env.name, env.id)));
}

function renderRunSelectors() {
  const collectionSelect = $("#collectionSelect");
  const caseSelect = $("#caseSelect");
  collectionSelect.innerHTML = "";
  caseSelect.innerHTML = "";
  const filteredCollections = state.collections.filter((collection) =>
    collectionMatchesProtocol(collection, state.selectedProtocol),
  );
  const filteredCases = state.cases.filter((testCase) => caseMatchesProtocol(testCase, state.selectedProtocol));

  if (!filteredCollections.length) {
    collectionSelect.append(new Option("No collection loaded", ""));
  } else {
    filteredCollections.forEach((collection) => collectionSelect.append(new Option(collection.name, collection.id)));
  }

  if (!filteredCases.length) {
    caseSelect.append(new Option("No test case loaded", ""));
  } else {
    filteredCases.forEach((testCase) => caseSelect.append(new Option(testCase.name, testCase.id)));
  }

  renderCollectionSummary();
  renderCaseSummary();
  renderRunReadiness();
}

function renderWorkspaceMetrics() {
  const latest = state.reports[state.reports.length - 1];
  $("#metricCollections").textContent = state.collections.length;
  $("#metricCases").textContent = state.cases.length;
  $("#metricLatest").textContent = latest ? latest.status : "No run";
  $("#metricPassRate").textContent = latest ? `${latest.summary.success_rate || 0}%` : "0%";
}

function renderRunReadiness() {
  const hasEnvironment = Boolean($("#globalEnvironment").value);
  const hasCollection = Boolean($("#collectionSelect").value);
  const node = $("#runReadiness");
  if (hasEnvironment && hasCollection) {
    node.textContent = "Ready";
    node.className = "readiness ready";
  } else if (hasCollection) {
    node.textContent = "Environment optional";
    node.className = "readiness caution";
  } else {
    node.textContent = "Waiting for scripts";
    node.className = "readiness";
  }
}

function renderCollectionSummary() {
  const id = $("#collectionSelect").value;
  const collection = state.collections.find((item) => item.id === id);
  $("#collectionSummary").innerHTML = collection
    ? `<span>${collectionProtocolLabel(collection)}</span><span>${collection.test_cases.length} cases</span><span>${collection.scenarios.length} scenarios</span>`
    : `<span>Load a ${state.selectedProtocol || "protocol"} suite in Admin.</span>`;
  renderRunReadiness();
}

function renderCaseSummary() {
  const id = $("#caseSelect").value;
  const testCase = state.cases.find((item) => item.id === id);
  $("#caseSummary").innerHTML = testCase
    ? `<span>${testCase.request.protocol}</span><span>${testCase.validations.length} validations</span>`
    : "<span>Load or create a test case in Admin.</span>";
}

function renderProtocolCoverage() {
  const protocols = ["REST", "TCP", "MQ", "DB"];
  const counts = state.cases.reduce((acc, testCase) => {
    const protocol = testCase.request.protocol;
    acc[protocol] = (acc[protocol] || 0) + 1;
    return acc;
  }, {});
  $("#protocolCoverage").innerHTML = protocols
    .map(
      (protocol) => `
        <div class="protocol-card">
          <span>${protocol}</span>
          <strong>${counts[protocol] || 0}</strong>
          <small>${coverageLabel(protocol, counts[protocol] || 0)}</small>
        </div>
      `,
    )
    .join("");
}

function coverageLabel(protocol, count) {
  if (count > 0) return "Configured";
  if (protocol === "TCP") return "Admin template available";
  return "Not loaded";
}

function renderLibrary() {
  const search = $("#librarySearch")?.value.trim().toLowerCase() || "";
  const protocolFilter = $("#libraryProtocol")?.value || "";
  const tree = $("#libraryTree");
  const visibleCollections = state.collections
    .map((collection) => {
      const cases = collection.test_cases.filter((testCase) => {
        const matchesProtocol = !protocolFilter || testCase.request.protocol === protocolFilter;
        const haystack = `${collection.name} ${testCase.name} ${(testCase.tags || []).join(" ")}`.toLowerCase();
        return matchesProtocol && (!search || haystack.includes(search));
      });
      const scenarios = collection.scenarios.filter((scenario) => {
        const haystack = `${collection.name} ${scenario.name} ${(scenario.tags || []).join(" ")}`.toLowerCase();
        return !protocolFilter && (!search || haystack.includes(search));
      });
      return { ...collection, test_cases: cases, scenarios };
    })
    .filter((collection) => collection.test_cases.length || collection.scenarios.length);

  if (!visibleCollections.length) {
    tree.innerHTML = '<div class="empty-state">No matching API scripts.</div>';
    $("#caseDetails").value = "Adjust the filter or import a suite.";
    return;
  }

  tree.innerHTML = visibleCollections
    .map(
      (collection) => `
        <div class="tree-group">
          <button class="tree-title ${state.selectedCollectionId === collection.id ? "selected" : ""}" type="button" data-collection-id="${collection.id}">
            <span>${escapeHtml(collection.name)}</span>
            <small>${collectionProtocolLabel(collection)}</small>
          </button>
          ${collection.test_cases
            .map(
              (item) => `
                <div class="tree-item ${state.selectedCaseId === item.id ? "selected" : ""}">
                  <button type="button" data-case-id="${item.id}">
                    <span class="method-badge ${methodClass(item.request.protocol)}">${protocolDisplay(item.request.protocol)}</span>
                    ${escapeHtml(item.name)}
                  </button>
                  <span>${item.validations.length} validations · ${item.tags.join(", ") || "No tags"}</span>
                </div>
              `,
            )
            .join("")}
          ${collection.scenarios
            .map(
              (item) => `
                <div class="tree-item scenario">
                  <button type="button" disabled>
                    <span class="method-badge e2e">E2E</span>
                    ${escapeHtml(item.name)}
                  </button>
                  <span>${item.steps.length} steps · ${item.tags.join(", ") || "No tags"}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");

  tree.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCaseId = button.dataset.caseId;
      state.selectedCollectionId = findCollectionForCase(state.selectedCaseId)?.id || state.selectedCollectionId;
      state.workbenchResult = null;
      renderLibrary();
      renderSuiteEditor();
      renderWorkbench();
    });
  });
  tree.querySelectorAll("[data-collection-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCollectionId = button.dataset.collectionId;
      renderLibrary();
      renderSuiteEditor();
    });
  });
}

function renderWorkbench() {
  const testCase = selectedWorkbenchCase();
  if (!testCase) {
    $("#workbenchTitle").textContent = "Select an API";
    $("#requestLine").innerHTML = '<span class="method-badge neutral">API</span><strong>No API selected</strong>';
    $("#caseDetails").value = "Select an API from the suite tree.";
    $("#validationList").innerHTML = '<div class="empty-state">No API selected.</div>';
    $("#workbenchResult").innerHTML = "Run the selected API to see response and validation results.";
    $("#runWorkbenchCaseButton").disabled = true;
    $("#saveWorkbenchCaseButton").disabled = true;
    return;
  }

  $("#runWorkbenchCaseButton").disabled = false;
  $("#saveWorkbenchCaseButton").disabled = false;
  $("#workbenchTitle").textContent = testCase.name;
  $("#requestLine").innerHTML = `
    <span class="method-badge ${methodClass(testCase.request.protocol)}">${protocolDisplay(testCase.request.protocol)}</span>
    <strong>${escapeHtml(requestHeadline(testCase))}</strong>
  `;
  $("#caseDetails").value = JSON.stringify(testCase, null, 2);
  $("#validationList").innerHTML = testCase.validations.length
    ? testCase.validations
        .map(
          (rule) => `
            <div class="validation-row">
              <strong>${escapeHtml(rule.name)}</strong>
              <span>${rule.source}${rule.path ? ` ${rule.path}` : ""} ${rule.operator} ${formatExpected(rule.expected)}</span>
            </div>
          `,
        )
        .join("")
    : '<div class="empty-state">No validation rules configured.</div>';

  $("#workbenchResult").innerHTML = state.workbenchResult
    ? workbenchResultMarkup(state.workbenchResult)
    : "Run the selected API to see response and validation results.";
}

function renderSuiteEditor() {
  const collection = selectedCollection();
  $("#saveSuiteButton").disabled = !collection;
  if (!collection) {
    $("#suiteNameInput").value = "";
    $("#suiteDescriptionInput").value = "";
    return;
  }
  $("#suiteNameInput").value = collection.name;
  $("#suiteDescriptionInput").value = collection.description || "";
}

function renderReports() {
  const reportList = $("#reportList");
  if (!state.reports.length) {
    reportList.innerHTML = '<div class="empty-state">No reports yet.</div>';
    return;
  }
  reportList.innerHTML = `
    <div class="report-table">
      <div class="report-row report-head">
        <span>Status</span>
        <span>Started</span>
        <span>Total</span>
        <span>Passed</span>
        <span>Failed</span>
        <span>Pass Rate</span>
      </div>
      ${state.reports
    .slice()
    .reverse()
    .map((report) => reportRowMarkup(report))
    .join("")}
    </div>
  `;
}

async function runSelectedCollection() {
  const collectionId = $("#collectionSelect").value;
  if (!collectionId) return toast("Load a collection before running.");
  await runAndRender("/runs/batch", {
    environment_id: selectedEnvironmentId(),
    collection_id: collectionId,
    stop_on_failure: $("#stopOnFailure").value === "true",
  });
}

async function runSelectedCase() {
  const caseId = $("#caseSelect").value;
  if (!caseId) return toast("Load a test case before running.");
  await runAndRender(`/runs/test-cases/${caseId}`, {
    environment_id: selectedEnvironmentId(),
  });
}

async function runWorkbenchCase() {
  const testCase = selectedWorkbenchCase();
  if (!testCase) return toast("Select an API before running.");
  try {
    setBusy(true);
    const report = await api(`/runs/test-cases/${testCase.id}`, {
      method: "POST",
      body: JSON.stringify({ environment_id: selectedEnvironmentId() }),
    });
    state.workbenchResult = report.case_results[0] || null;
    state.latestReport = report;
    await refreshAll();
    state.workbenchResult = report.case_results[0] || null;
    renderWorkbench();
    $$(".workbench-tab").forEach((item) => item.classList.remove("active"));
    $$(".workbench-panel").forEach((panel) => panel.classList.remove("active"));
    $('[data-workbench="response"]').classList.add("active");
    $("#workbench-response").classList.add("active");
    toast("API run completed.");
  } catch (error) {
    toast(`API run failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function saveWorkbenchCase() {
  const testCase = selectedWorkbenchCase();
  if (!testCase) return toast("Select an API before saving.");
  try {
    const payload = JSON.parse($("#caseDetails").value);
    const caseId = payload.id || testCase.id;
    delete payload.id;
    const updated = await api(`/test-cases/${caseId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    state.selectedCaseId = updated.id;
    state.workbenchResult = null;
    await refreshAll();
    toast("API case saved.");
  } catch (error) {
    toast(`Save API failed: ${error.message}`);
  }
}

async function importSuiteFromFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const collection = await api("/collections/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.selectedCollectionId = collection.id;
    state.selectedCaseId = collection.test_cases[0]?.id || null;
    await refreshAll();
    toast(`${collection.name} imported.`);
  } catch (error) {
    toast(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function exportSelectedSuite() {
  const collection = selectedCollection();
  if (!collection) return toast("Select a suite before exporting.");
  try {
    const postman = await api(`/collections/${collection.id}/postman`);
    const blob = new Blob([JSON.stringify(postman, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const safeName = collection.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "collection";
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}.postman_collection.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Postman collection exported.");
  } catch (error) {
    toast(`Export failed: ${error.message}`);
  }
}

async function saveSelectedSuite() {
  const collection = selectedCollection();
  if (!collection) return toast("Select a suite before saving.");
  try {
    const updated = {
      ...collection,
      name: $("#suiteNameInput").value.trim(),
      description: $("#suiteDescriptionInput").value.trim(),
    };
    if (!updated.name) throw new Error("Suite name is required.");
    await api(`/collections/${collection.id}`, {
      method: "PUT",
      body: JSON.stringify(updated),
    });
    await refreshAll();
    toast("Suite saved.");
  } catch (error) {
    toast(`Save suite failed: ${error.message}`);
  }
}

async function runAndRender(path, body) {
  try {
    setBusy(true);
    const report = await api(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.latestReport = report;
    $("#latestStatus").className = `pill ${statusClass(report.status)}`;
    $("#latestStatus").textContent = report.status;
    $("#latestReport").innerHTML = reportMarkup(report, true);
    await refreshAll();
    $("#latestStatus").className = `pill ${statusClass(report.status)}`;
    $("#latestStatus").textContent = report.status;
    $("#latestReport").innerHTML = reportMarkup(report, true);
    toast("Run completed.");
  } catch (error) {
    toast(`Run failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function saveEnvironment() {
  try {
    const payload = {
      name: $("#envName").value.trim(),
      description: $("#envDescription").value.trim(),
      variables: JSON.parse($("#envVariables").value || "{}"),
      rollback: { mode: "manual" },
    };
    if (!payload.name) throw new Error("Environment name is required.");
    await api("/environments", { method: "POST", body: JSON.stringify(payload) });
    await refreshAll();
    toast("Environment saved.");
  } catch (error) {
    toast(`Save failed: ${error.message}`);
  }
}

async function createStarterSetup() {
  try {
    setBusy(true);
    const environment = await api("/environments", {
      method: "POST",
      body: JSON.stringify({
        name: "Local Starter",
        description: "Default environment for smoke testing and UI validation.",
        variables: defaultEnvironmentVariables(),
        rollback: { mode: "manual", snapshot: "LOCAL_STARTER" },
      }),
    });
    for (const collection of buildStarterCollections()) {
      await api("/collections", {
        method: "POST",
        body: JSON.stringify(collection),
      });
    }
    await refreshAll();
    $("#globalEnvironment").value = environment.id;
    toast("Protocol suites created.");
  } catch (error) {
    toast(`Starter setup failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function saveCollection() {
  try {
    const payload = JSON.parse($("#collectionJson").value);
    await api("/collections", { method: "POST", body: JSON.stringify(payload) });
    await refreshAll();
    toast("Collection loaded.");
  } catch (error) {
    toast(`Load failed: ${error.message}`);
  }
}

async function saveCase() {
  try {
    const payload = JSON.parse($("#testCaseJson").value);
    await api("/test-cases", { method: "POST", body: JSON.stringify(payload) });
    await refreshAll();
    toast("Test case saved.");
  } catch (error) {
    toast(`Save failed: ${error.message}`);
  }
}

function selectedEnvironmentId() {
  return $("#globalEnvironment").value || null;
}

function defaultEnvironmentVariables() {
  return {
    rest_base_url: "https://sit-api.company.com",
    platform_base_url: window.location.origin,
    as400_host: "10.10.20.30",
    as400_auth_port: "9001",
    mq_host: "10.10.20.40",
  };
}

function buildStarterCollections() {
  const cases = sampleCollection.test_cases;
  const byProtocol = (protocol) => cases.filter((testCase) => testCase.request.protocol === protocol);
  return [
    {
      name: "REST API Testing Suite",
      description: "API-level REST tests for gateway readiness and authorization inquiry.",
      test_cases: byProtocol("REST"),
      scenarios: [],
    },
    {
      name: "TCP/IP Authorization Testing Suite",
      description: "API-level TCP/IP authorization tests for AS400 approval, decline and SLA validation.",
      test_cases: byProtocol("TCP"),
      scenarios: [],
    },
    {
      name: "MQ Event Testing Suite",
      description: "API-level IBM MQ transaction tests for settlement and fraud event messages.",
      test_cases: byProtocol("MQ"),
      scenarios: [],
    },
    {
      name: "Backend DB Validation Suite",
      description: "Backend validation checks used by end-to-end transaction testing.",
      test_cases: byProtocol("DB"),
      scenarios: [],
    },
    {
      name: "End-to-End Authorization Flow Suite",
      description: "Cross-protocol scenario chaining REST, TCP/IP, MQ and DB validation.",
      test_cases: [],
      scenarios: sampleCollection.scenarios,
    },
  ];
}

function renderSampleSuiteSelect() {
  const select = $("#sampleSuiteSelect");
  if (!select) return;
  select.innerHTML = "";
  buildStarterCollections().forEach((collection, index) => {
    select.append(new Option(collection.name, String(index)));
  });
  select.value = "1";
}

function selectedSampleSuite() {
  const suites = buildStarterCollections();
  const index = Number($("#sampleSuiteSelect")?.value || 0);
  return suites[index] || suites[0];
}

function collectionMatchesProtocol(collection, protocol) {
  if (!protocol) return true;
  if (protocol === "E2E") return collection.scenarios.length > 0 || collectionProtocolLabel(collection) === "E2E";
  return collection.test_cases.some((testCase) => testCase.request.protocol === protocol);
}

function caseMatchesProtocol(testCase, protocol) {
  if (!protocol || protocol === "E2E") return true;
  return testCase.request.protocol === protocol;
}

function collectionProtocolLabel(collection) {
  if (collection.scenarios.length && !collection.test_cases.length) return "E2E";
  const protocols = new Set(collection.test_cases.map((testCase) => testCase.request.protocol));
  return protocols.size === 1 ? Array.from(protocols)[0] : "Mixed";
}

function selectedWorkbenchCase() {
  if (!state.selectedCaseId && state.cases.length) {
    const preferred = state.cases.find((testCase) => testCase.request.protocol === "TCP") || state.cases[0];
    state.selectedCaseId = preferred.id;
    state.selectedCollectionId = findCollectionForCase(preferred.id)?.id || null;
  }
  return state.cases.find((testCase) => testCase.id === state.selectedCaseId) || null;
}

function selectedCollection() {
  if (!state.selectedCollectionId) {
    const testCase = selectedWorkbenchCase();
    state.selectedCollectionId = findCollectionForCase(testCase?.id)?.id || state.collections[0]?.id || null;
  }
  return state.collections.find((collection) => collection.id === state.selectedCollectionId) || null;
}

function findCollectionForCase(caseId) {
  if (!caseId) return null;
  return state.collections.find((collection) => collection.test_cases.some((testCase) => testCase.id === caseId)) || null;
}

function protocolDisplay(protocol) {
  return protocol === "TCP" ? "TCP/IP" : protocol;
}

function methodClass(protocol) {
  return String(protocol || "neutral").toLowerCase();
}

function requestHeadline(testCase) {
  if (testCase.request.rest) return `${testCase.request.rest.method} ${testCase.request.rest.url}`;
  if (testCase.request.tcp) return `${testCase.request.tcp.host}:${testCase.request.tcp.port}`;
  if (testCase.request.mq) return `${testCase.request.mq.queue_manager} / ${testCase.request.mq.request_queue}`;
  if (testCase.request.db) return testCase.request.db.query;
  return testCase.request.protocol;
}

function formatExpected(value) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function workbenchResultMarkup(result) {
  return `
    <div class="response-summary">
      <span class="pill ${result.passed ? "pass" : "fail"}">${result.passed ? "PASSED" : "FAILED"}</span>
      <span>${result.protocol}</span>
      <span>${result.response.response_time_ms} ms</span>
    </div>
    <div class="validation-list">
      ${result.validations
        .map(
          (item) => `
            <div class="validation-row ${item.passed ? "passed" : "failed"}">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.passed ? "Passed" : item.message || "Failed"}</span>
            </div>
          `,
        )
        .join("")}
    </div>
    <pre class="code-view">${escapeHtml(JSON.stringify(result.response, null, 2))}</pre>
  `;
}

function reportMarkup(report, expanded) {
  const summary = report.summary || {};
  const details = expanded ? caseResultsMarkup(report) : "";
  return `
    <article class="report-item">
      <div class="report-meta">
        <strong>${report.id}</strong>
        <span class="pill ${statusClass(report.status)}">${report.status}</span>
      </div>
      <span>${formatDate(report.started_at)} - ${summary.total || 0} total, ${summary.passed || 0} passed, ${summary.failed || 0} failed</span>
      ${
        expanded
          ? `<div class="metric-grid">
              <div class="metric"><span>Total</span><strong>${summary.total || 0}</strong></div>
              <div class="metric"><span>Passed</span><strong>${summary.passed || 0}</strong></div>
              <div class="metric"><span>Failed</span><strong>${summary.failed || 0}</strong></div>
              <div class="metric"><span>Success Rate</span><strong>${summary.success_rate || 0}%</strong></div>
            </div>`
          : ""
      }
      ${details}
    </article>
  `;
}

function reportRowMarkup(report) {
  const summary = report.summary || {};
  return `
    <div class="report-row">
      <span><span class="pill ${statusClass(report.status)}">${report.status}</span></span>
      <span>${formatDate(report.started_at)}</span>
      <span>${summary.total || 0}</span>
      <span>${summary.passed || 0}</span>
      <span>${summary.failed || 0}</span>
      <span>${summary.success_rate || 0}%</span>
    </div>
  `;
}

function caseResultsMarkup(report) {
  const scenarioSteps = (report.scenario_results || []).flatMap((scenario) => scenario.steps || []);
  const results = [...(report.case_results || []), ...scenarioSteps];
  if (!results.length) return "";
  return `
    <div class="tree">
      ${results
        .map(
          (result) => `
            <div class="tree-item">
              <strong>${escapeHtml(result.case_name)}</strong>
              <span>${result.protocol} - ${result.passed ? "Passed" : "Failed"}</span>
              <span>${failureReason(result)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function failureReason(result) {
  if (result.passed) return "All validations passed.";
  if (result.response && result.response.error) return result.response.error;
  const failed = (result.validations || []).find((item) => !item.passed);
  return failed ? failed.message || failed.name : "Unknown failure.";
}

function statusClass(status) {
  if (status === "PASSED") return "pass";
  if (status === "FAILED") return "fail";
  if (status === "PARTIAL") return "partial";
  return "neutral";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function setBusy(isBusy) {
  $("#runCollectionButton").disabled = isBusy;
  $("#runCaseButton").disabled = isBusy;
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
