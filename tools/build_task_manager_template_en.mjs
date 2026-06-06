import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/ericlin/Documents/GitHub/testing-agent/outputs/task-manager-template";
const outputPath = `${outputDir}/manager_task_os_template_en_v3.xlsx`;

const wb = Workbook.create();
const C = {
  navy: "#1F3A5F",
  teal: "#0F766E",
  surface: "#F6F8FB",
  header: "#E8EEF7",
  body: "#FFFFFF",
  border: "#D6DEE9",
  text: "#172033",
  muted: "#667085",
  redSoft: "#FEE2E2",
  redText: "#991B1B",
};

function setWidths(sheet, widths) {
  widths.forEach((w, i) => sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidthPx = w);
}

function title(sheet, lastCol, text, subtitle) {
  sheet.getRange(`A1:${lastCol}1`).format.fill = { color: C.navy };
  sheet.getRange("A1").values = [[text]];
  sheet.getRange("A1").format.font = { name: "Aptos Display", bold: true, color: "#FFFFFF", size: 18 };
  sheet.getRange("A1").format.rowHeightPx = 42;
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format.font = { italic: true, color: C.muted };
  sheet.getRange("A2").format.fill = { color: C.surface };
}

function header(range) {
  range.format.fill = { color: C.header };
  range.format.font = { bold: true, color: C.text };
  range.format.borders = { bottom: { style: "continuous", color: C.border } };
  range.format.wrapText = true;
  range.format.verticalAlignment = "middle";
}

function panel(range) {
  range.format.fill = { color: C.body };
  range.format.borders = {
    top: { style: "continuous", color: C.border },
    bottom: { style: "continuous", color: C.border },
    left: { style: "continuous", color: C.border },
    right: { style: "continuous", color: C.border },
    insideHorizontal: { style: "continuous", color: C.border },
    insideVertical: { style: "continuous", color: C.border },
  };
}

function applyTaskDropdowns(sheet, startRow, endRow) {
  sheet.getRange(`C${startRow}:C${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$C$5:$C$12" } };
  sheet.getRange(`D${startRow}:D${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$F$5:$F$24" } };
  sheet.getRange(`E${startRow}:E${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$I$5:$I$24" } };
  sheet.getRange(`F${startRow}:F${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$B$5:$B$8" } };
  sheet.getRange(`G${startRow}:G${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$A$5:$A$11" } };
  sheet.getRange(`L${startRow}:M${endRow}`).dataValidation = { rule: { type: "list", values: ["Yes", "No"] } };
  sheet.getRange(`Q${startRow}:Q${endRow}`).dataValidation = { rule: { type: "list", formula1: "Settings!$D$5:$D$9" } };
}

const dashboard = wb.worksheets.add("Dashboard");
const tasks = wb.worksheets.add("Task Inbox");
const daily = wb.worksheets.add("Daily Plan");
const projects = wb.worksheets.add("Projects");
const waiting = wb.worksheets.add("Delegated Waiting");
const settings = wb.worksheets.add("Settings");
for (const s of [dashboard, tasks, daily, projects, waiting, settings]) s.showGridLines = false;

// Settings
title(settings, "J", "Settings", "Maintain fixed values here. Dropdowns in the workbook reference these lists.");
settings.getRange("A4:D4").values = [["Status", "Priority", "Task Type", "Cadence"]];
settings.getRange("F4:G4").values = [["Project", "Project Owner"]];
settings.getRange("I4").values = [["Owner List"]];
header(settings.getRange("A4:D4"));
header(settings.getRange("F4:G4"));
header(settings.getRange("I4"));
settings.getRange("A5:A11").values = [["Not Started"], ["In Progress"], ["Waiting on Others"], ["Blocked"], ["Scheduled"], ["Done"], ["Canceled"]];
settings.getRange("B5:B8").values = [["P0 Critical"], ["P1 High"], ["P2 Medium"], ["P3 Low"]];
settings.getRange("C5:C12").values = [["Personal"], ["Team"], ["Project"], ["Meeting"], ["Decision"], ["Follow-up"], ["Admin"], ["Risk"]];
settings.getRange("D5:D9").values = [["One-time"], ["Daily"], ["Weekly"], ["Monthly"], ["Quarterly"]];
settings.getRange("F5:G14").values = [
  ["Weekly Ops", "Me"],
  ["Customer Delivery", "Alice"],
  ["Product Improvements", "Ben"],
  ["Team Management", "Me"],
  ["Hiring", "HR"],
  ["Budget Planning", "Finance"],
  ["Process Optimization", "Product"],
  ["Personal Management", "Me"],
  ["Cross-functional", "Me"],
  ["Risk Handling", "Me"],
];
settings.getRange("I5:I14").values = [["Me"], ["Alice"], ["Ben"], ["Carla"], ["David"], ["Finance"], ["Product"], ["HR"], ["Sales"], ["Legal"]];
panel(settings.getRange("A4:I24"));
setWidths(settings, [150, 130, 130, 120, 28, 190, 140, 28, 140, 80]);

const taskHeaders = [
  "ID", "Task", "Type", "Project", "Owner", "Priority", "Status", "Due Date",
  "Effort (h)", "Progress", "Next Step", "Today?", "Delegated?", "Blocker",
  "Last Updated", "Notes", "Cadence",
  "System Daily Rank", "System Waiting Rank",
];
const sampleRows = [
  ["T-001", "Confirm this week's team Top 3 priorities", "Team", "Team Management", "Me", "P0 Critical", "In Progress", new Date(2026, 5, 1), 1, 0.5, "Confirm owner in 15-min standup", "Yes", "No", "", new Date(2026, 5, 1), "Update every morning", "Weekly", null, null],
  ["T-002", "Follow up on customer delivery risk list", "Project", "Customer Delivery", "Alice", "P1 High", "Waiting on Others", new Date(2026, 5, 2), 2, 0.35, "Waiting for risk rating from Alice", "Yes", "Yes", "", new Date(2026, 5, 1), "Need feedback by 3 PM", "One-time", null, null],
  ["T-003", "Approve Q3 budget draft", "Decision", "Budget Planning", "Me", "P1 High", "Not Started", new Date(2026, 5, 5), 1.5, 0, "Review Finance version", "No", "No", "", new Date(2026, 5, 1), "", "Quarterly", null, null],
  ["T-004", "Compile hiring interview feedback", "Meeting", "Hiring", "HR", "P2 Medium", "Blocked", new Date(2026, 4, 30), 1, 0.2, "Ask HR for missing scorecard", "Yes", "Yes", "Missing interviewer scorecard", new Date(2026, 5, 1), "Overdue example", "One-time", null, null],
  ["T-005", "Archive product improvement meeting notes", "Follow-up", "Product Improvements", "Ben", "P2 Medium", "Done", new Date(2026, 4, 31), 0.5, 1, "Archive notes", "No", "Yes", "", new Date(2026, 5, 1), "", "Weekly", null, null],
  ["T-006", "Map cross-functional SLA workflow", "Project", "Process Optimization", "Product", "P1 High", "In Progress", new Date(2026, 5, 7), 3, 0.65, "Add Legal review node", "No", "Yes", "", new Date(2026, 5, 1), "", "Monthly", null, null],
];
const blank = Array(taskHeaders.length).fill(null);

// Task Inbox
title(tasks, "Q", "Manager Task OS: Task Inbox", "Capture tasks quickly and manage owner, project, status, due date, blockers, and cadence with dropdowns.");
tasks.getRange("A5:S5").values = [taskHeaders];
header(tasks.getRange("A5:S5"));
const taskRows = [...sampleRows];
while (taskRows.length < 500) taskRows.push([...blank]);
tasks.getRange("A6:S505").values = taskRows;
tasks.getRange("R6:S505").formulas = Array.from({ length: 500 }, (_, i) => {
  const r = 6 + i;
  return [
    `=IF(AND($B${r}<>"",$G${r}<>"Done",$G${r}<>"Canceled",OR($L${r}="Yes",$H${r}<=TODAY()+1,$F${r}="P0 Critical",$F${r}="P1 High",$G${r}="Blocked",$G${r}="Waiting on Others")),COUNT($R$5:R${r - 1})+1,"")`,
    `=IF(AND($B${r}<>"",$G${r}<>"Done",$G${r}<>"Canceled",OR($M${r}="Yes",$G${r}="Blocked",$G${r}="Waiting on Others")),COUNT($S$5:S${r - 1})+1,"")`,
  ];
});
tasks.getRange("H6:H505").setNumberFormat("yyyy-mm-dd");
tasks.getRange("O6:O505").setNumberFormat("yyyy-mm-dd");
tasks.getRange("J6:J505").setNumberFormat("0%");
tasks.getRange("I6:I505").setNumberFormat("0.0");
tasks.tables.add("A5:S505", true, "TaskInboxTable");
tasks.freezePanes.freezeRows(5);
applyTaskDropdowns(tasks, 6, 505);
tasks.getRange("H6:H505").conditionalFormats.add("expression", {
  formula: '=AND($H6<TODAY(),$G6<>"Done",$G6<>"Canceled",$B6<>"")',
  format: { fill: { color: C.redSoft }, font: { color: C.redText, bold: true } },
});
setWidths(tasks, [80, 280, 120, 170, 120, 120, 140, 115, 95, 90, 250, 80, 95, 220, 115, 250, 120, 4, 4]);
tasks.getRange("R5:S505").format.font = { color: "#FFFFFF", size: 1 };
tasks.getRange("R5:S505").format.fill = { color: "#FFFFFF" };
tasks.getRange("A5:S505").format.wrapText = true;

// Dashboard
title(dashboard, "M", "Manager Task OS: Dashboard", "Start here every day: due soon, overdue, waiting, blockers, and project health.");
dashboard.getRange("A4:B9").values = [["Metric", "Count"], ["Open Tasks", null], ["Due Today/Tomorrow", null], ["Overdue", null], ["Waiting on Others", null], ["Blocked", null]];
dashboard.getRange("B5:B9").formulas = [
  ['=COUNTIFS(\'Task Inbox\'!$B$6:$B$505,"<>",\'Task Inbox\'!$G$6:$G$505,"<>Done",\'Task Inbox\'!$G$6:$G$505,"<>Canceled")'],
  ['=COUNTIFS(\'Task Inbox\'!$B$6:$B$505,"<>",\'Task Inbox\'!$G$6:$G$505,"<>Done",\'Task Inbox\'!$H$6:$H$505,"<="&TODAY()+1)'],
  ['=COUNTIFS(\'Task Inbox\'!$B$6:$B$505,"<>",\'Task Inbox\'!$G$6:$G$505,"<>Done",\'Task Inbox\'!$H$6:$H$505,"<"&TODAY())'],
  ['=COUNTIFS(\'Task Inbox\'!$G$6:$G$505,"Waiting on Others")'],
  ['=COUNTIFS(\'Task Inbox\'!$G$6:$G$505,"Blocked")'],
];
header(dashboard.getRange("A4:B4")); panel(dashboard.getRange("A4:B9"));
dashboard.getRange("D4:E11").values = [["Status", "Count"], ["Not Started", null], ["In Progress", null], ["Waiting on Others", null], ["Blocked", null], ["Scheduled", null], ["Done", null], ["Canceled", null]];
dashboard.getRange("E5:E11").formulas = Array.from({ length: 7 }, (_, i) => [`=COUNTIFS('Task Inbox'!$G$6:$G$505,D${5 + i})`]);
header(dashboard.getRange("D4:E4")); panel(dashboard.getRange("D4:E11"));
dashboard.getRange("G4:H8").values = [["Priority", "Open"], ["P0 Critical", null], ["P1 High", null], ["P2 Medium", null], ["P3 Low", null]];
dashboard.getRange("H5:H8").formulas = Array.from({ length: 4 }, (_, i) => [`=COUNTIFS('Task Inbox'!$F$6:$F$505,G${5 + i},'Task Inbox'!$G$6:$G$505,"<>Done",'Task Inbox'!$B$6:$B$505,"<>")`]);
header(dashboard.getRange("G4:H4")); panel(dashboard.getRange("G4:H8"));
dashboard.getRange("A12:M17").values = [
  ["Daily Manager Rhythm", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Morning 10 min", "Clear new tasks and mark what must move today", "", "", "", "", "", "", "", "", "", "", ""],
  ["Midday 10 min", "Review delegated/waiting items and remove blockers", "", "", "", "", "", "", "", "", "", "", ""],
  ["End of day 10 min", "Update progress and rewrite vague work into a clear next step", "", "", "", "", "", "", "", "", "", "", ""],
  ["Weekly review", "Delete low-value tasks and reset the team Top 3", "", "", "", "", "", "", "", "", "", "", ""],
  ["Rule", "Every active task needs owner, status, due date, and next step", "", "", "", "", "", "", "", "", "", "", ""],
];
dashboard.getRange("A12").format.fill = { color: C.teal };
dashboard.getRange("A12").format.font = { bold: true, color: "#FFFFFF" };
panel(dashboard.getRange("A13:M17"));
const statusChart = dashboard.charts.add("bar", dashboard.getRange("D4:E11"));
statusChart.setPosition("J4", "M11");
statusChart.title = "Tasks by Status";
statusChart.hasLegend = false;
const priChart = dashboard.charts.add("bar", dashboard.getRange("G4:H8"));
priChart.setPosition("J13", "M22");
priChart.title = "Open Tasks by Priority";
priChart.hasLegend = false;
setWidths(dashboard, [165, 90, 28, 150, 90, 28, 130, 90, 28, 95, 95, 95, 95]);

// Daily Plan
title(daily, "K", "Daily Plan", "Read-only formula view. Add or update tasks only in Task Inbox; this page pulls today's focus items automatically.");
const dailyHeaders = ["ID", "Task", "Project", "Owner", "Priority", "Status", "Due Date", "Progress", "Next Step", "Blocker", "Reason Shown"];
daily.getRange("A4:K4").values = [dailyHeaders];
header(daily.getRange("A4:K4"));
const dailySourceCols = ["A", "B", "D", "E", "F", "G", "H", "J", "K", "N"];
daily.getRange("A5:J54").formulas = Array.from({ length: 50 }, (_, i) =>
  dailySourceCols.map((col) => `=IFERROR(INDEX('Task Inbox'!${col}$6:${col}$505,MATCH(ROWS($A$5:A${5 + i}),'Task Inbox'!$R$6:$R$505,0)),"")`)
);
daily.getRange("K5:K54").formulas = Array.from({ length: 50 }, (_, i) => {
  const r = 5 + i;
  return [`=IF($A${r}="","",IF($F${r}="Blocked","Blocked",IF($F${r}="Waiting on Others","Waiting",IF($G${r}<TODAY(),"Overdue",IF($G${r}<=TODAY()+1,"Due Soon","Priority")))))`];
});
daily.getRange("G5:G54").setNumberFormat("yyyy-mm-dd");
daily.getRange("H5:H54").setNumberFormat("0%");
daily.freezePanes.freezeRows(4);
setWidths(daily, [80, 300, 170, 120, 120, 150, 115, 90, 280, 220, 120]);
daily.getRange("A4:K30").format.wrapText = true;

// Projects
title(projects, "I", "Projects", "Read-only project summary. Maintain project names and owners in Settings; task metrics come from Task Inbox.");
projects.getRange("A5:I5").values = [["Project", "Project Owner", "Status", "Total Tasks", "Open", "Overdue", "Blocked", "Waiting", "Completion"]];
header(projects.getRange("A5:J5"));
projects.getRange("A6:B25").formulas = Array.from({ length: 20 }, (_, i) => {
  const r = 6 + i;
  return [
    `=IF(Settings!F${5 + i}="","",Settings!F${5 + i})`,
    `=IF(Settings!G${5 + i}="","",Settings!G${5 + i})`,
  ];
});
projects.getRange("C6:I25").formulas = Array.from({ length: 20 }, (_, i) => {
  const r = 6 + i;
  return [
    `=IF($A${r}="","",IF(G${r}>0,"Blocked",IF(H${r}>0,"Waiting on Others",IF(E${r}>0,"In Progress",IF(D${r}>0,"Done","Not Started")))))`,
    `=IF($A${r}="","",COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$B$6:$B$505,"<>"))`,
    `=IF($A${r}="","",COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$G$6:$G$505,"<>Done",'Task Inbox'!$G$6:$G$505,"<>Canceled",'Task Inbox'!$B$6:$B$505,"<>"))`,
    `=IF($A${r}="","",COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$G$6:$G$505,"<>Done",'Task Inbox'!$G$6:$G$505,"<>Canceled",'Task Inbox'!$H$6:$H$505,"<"&TODAY(),'Task Inbox'!$B$6:$B$505,"<>"))`,
    `=IF($A${r}="","",COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$G$6:$G$505,"Blocked",'Task Inbox'!$B$6:$B$505,"<>"))`,
    `=IF($A${r}="","",COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$G$6:$G$505,"Waiting on Others",'Task Inbox'!$B$6:$B$505,"<>"))`,
    `=IF($A${r}="","",IFERROR(COUNTIFS('Task Inbox'!$D$6:$D$505,$A${r},'Task Inbox'!$G$6:$G$505,"Done")/D${r},0))`,
  ];
});
projects.getRange("I6:I25").setNumberFormat("0%");
projects.tables.add("A5:I25", true, "ProjectsTable");
projects.freezePanes.freezeRows(5);
setWidths(projects, [190, 140, 150, 95, 85, 85, 85, 85, 100]);
projects.getRange("A5:I25").format.wrapText = true;

// Delegated Waiting
title(waiting, "K", "Delegated / Waiting", "Read-only formula view. It automatically shows delegated, blocked, and waiting-on-others tasks from Task Inbox.");
waiting.getRange("A4:K4").values = [["ID", "Task", "Project", "Owner", "Priority", "Status", "Due Date", "Progress", "Next Step", "Blocker", "Last Updated"]];
header(waiting.getRange("A4:K4"));
const waitingSourceCols = ["A", "B", "D", "E", "F", "G", "H", "J", "K", "N", "O"];
waiting.getRange("A5:K54").formulas = Array.from({ length: 50 }, (_, i) =>
  waitingSourceCols.map((col) => `=IFERROR(INDEX('Task Inbox'!${col}$6:${col}$505,MATCH(ROWS($A$5:A${5 + i}),'Task Inbox'!$S$6:$S$505,0)),"")`)
);
waiting.getRange("G5:G54").setNumberFormat("yyyy-mm-dd");
waiting.getRange("H5:H54").setNumberFormat("0%");
waiting.getRange("K5:K54").setNumberFormat("yyyy-mm-dd");
waiting.freezePanes.freezeRows(4);
setWidths(waiting, [80, 300, 170, 120, 120, 150, 115, 90, 280, 220, 115]);
waiting.getRange("A4:K30").format.wrapText = true;

for (const s of [dashboard, tasks, daily, projects, waiting, settings]) {
  const used = s.getUsedRange();
  used.format.font = { name: "Aptos", color: C.text, size: 10 };
}
for (const [s, col] of [[dashboard, "M"], [tasks, "Q"], [daily, "K"], [projects, "I"], [waiting, "K"], [settings, "J"]]) {
  s.getRange(`A1:${col}1`).format.fill = { color: C.navy };
  s.getRange("A1").format.font = { name: "Aptos Display", bold: true, color: "#FFFFFF", size: 18 };
}
const dashCheck = await wb.inspect({ kind: "table", range: "Dashboard!A4:H11", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 8, maxChars: 3000 });
console.log(dashCheck.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "formula error scan", maxChars: 2000 });
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
for (const sheetName of ["Dashboard", "Task Inbox", "Daily Plan", "Projects", "Delegated Waiting", "Settings"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_")}_en.png`, new Uint8Array(await preview.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(outputPath);
