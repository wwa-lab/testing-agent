import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/ericlin/Documents/GitHub/testing-agent/outputs/task-manager-template";
const outputPath = `${outputDir}/manager_task_os_template.xlsx`;

const wb = Workbook.create();

const colors = {
  navy: "#1F3A5F",
  blue: "#2F80ED",
  teal: "#0F766E",
  amber: "#F59E0B",
  red: "#DC2626",
  green: "#16A34A",
  surface: "#F6F8FB",
  header: "#E8EEF7",
  body: "#FFFFFF",
  border: "#D6DEE9",
  text: "#172033",
  muted: "#667085",
};

function title(sheet, range, text, subtitle) {
  const titleRange = sheet.getRange(range);
  const [start, end] = range.split(":");
  const startCol = start.match(/[A-Z]+/)[0];
  const endCol = end.match(/[A-Z]+/)[0];
  const startRow = Number(start.match(/\d+/)[0]);
  const colCount = colToNumber(endCol) - colToNumber(startCol) + 1;
  titleRange.values = [Array(colCount).fill("")];
  sheet.getRange(start).values = [[text]];
  titleRange.format.fill = { color: colors.navy };
  sheet.getRange(start).format.font = { bold: true, color: "#FFFFFF", size: 18 };
  sheet.getRange(start).format.horizontalAlignment = "left";
  titleRange.format.verticalAlignment = "middle";
  titleRange.format.rowHeightPx = 42;
  if (subtitle) {
    const row = startRow + 1;
    sheet.getRange(`A${row}`).values = [[subtitle]];
    sheet.getRange(`A${row}`).format.fill = { color: colors.surface };
    sheet.getRange(`A${row}`).format.font = { color: colors.muted, italic: true };
    sheet.getRange(`A${row}`).format.horizontalAlignment = "left";
  }
}

function colToNumber(col) {
  return col.split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0);
}

function styleHeader(range) {
  range.format.fill = { color: colors.header };
  range.format.font = { bold: true, color: colors.text };
  range.format.borders = {
    bottom: { style: "continuous", color: colors.border },
  };
  range.format.wrapText = true;
  range.format.verticalAlignment = "middle";
}

function styleBlock(range) {
  range.format.fill = { color: colors.body };
  range.format.borders = {
    top: { style: "continuous", color: colors.border },
    bottom: { style: "continuous", color: colors.border },
    left: { style: "continuous", color: colors.border },
    right: { style: "continuous", color: colors.border },
  };
}

function setWidths(sheet, widths) {
  widths.forEach((width, idx) => {
    sheet.getRangeByIndexes(0, idx, 1, 1).format.columnWidthPx = width;
  });
}

function addStatusFormats(range) {
  range.format.font = { color: colors.text };
}

const dashboard = wb.worksheets.add("仪表盘");
const tasks = wb.worksheets.add("任务收集");
const daily = wb.worksheets.add("每日计划");
const projects = wb.worksheets.add("团队项目");
const waiting = wb.worksheets.add("委派等待");
const settings = wb.worksheets.add("设置");

for (const s of [dashboard, tasks, daily, projects, waiting, settings]) {
  s.showGridLines = false;
}

// Settings
title(settings, "A1:H1", "设置 / 下拉选项", "维护项目、成员、状态、优先级；任务表的下拉菜单会引用这里的选项。");
settings.getRange("A4:D4").values = [["状态", "优先级", "类型", "频率"]];
settings.getRange("F4:G4").values = [["项目", "成员"]];
styleHeader(settings.getRange("A4:D4"));
styleHeader(settings.getRange("F4:G4"));
settings.getRange("A5:A11").values = [["未开始"], ["进行中"], ["等待别人"], ["阻塞"], ["已安排"], ["完成"], ["取消"]];
settings.getRange("B5:B8").values = [["P0 紧急"], ["P1 高"], ["P2 中"], ["P3 低"]];
settings.getRange("C5:C10").values = [["个人"], ["团队"], ["项目"], ["会议"], ["决策"], ["跟进"]];
settings.getRange("D5:D8").values = [["一次性"], ["每日"], ["每周"], ["每月"]];
settings.getRange("F5:F14").values = [
  ["运营例会"], ["客户交付"], ["产品改进"], ["团队管理"], ["招聘面试"],
  ["预算规划"], ["流程优化"], ["个人管理"], ["跨部门协作"], ["风险处理"],
];
settings.getRange("G5:G14").values = [
  ["我"], ["张三"], ["李四"], ["王五"], ["陈敏"],
  ["Finance"], ["Product"], ["HR"], ["Sales"], ["Legal"],
];
settings.getRange("A4:G14").format.borders = {
  top: { style: "continuous", color: colors.border },
  bottom: { style: "continuous", color: colors.border },
  left: { style: "continuous", color: colors.border },
  right: { style: "continuous", color: colors.border },
  insideHorizontal: { style: "continuous", color: colors.border },
  insideVertical: { style: "continuous", color: colors.border },
};
setWidths(settings, [130, 120, 120, 120, 32, 160, 130, 80]);

// Task collection
title(tasks, "A1:P1", "Manager Task OS：任务收集", "像 Todoist 一样快速收集任务，像 Asana 一样管理 owner、项目、状态、截止日期和阻塞。");
const taskHeaders = [
  "ID", "任务", "类型", "所属项目", "Owner", "优先级", "状态", "截止日期",
  "预计耗时(h)", "进度", "下一步", "今日?", "委派?", "阻塞原因", "更新日期", "备注",
];
tasks.getRange("A5:P5").values = [taskHeaders];
styleHeader(tasks.getRange("A5:P5"));
const today = new Date(2026, 5, 1);
const sampleRows = [
  ["T-001", "确认本周团队 Top 3 优先级", "团队", "团队管理", "我", "P0 紧急", "进行中", today, 1, 0.5, "15 分钟站会确认 owner", "是", "否", "", today, "每天早上更新"],
  ["T-002", "跟进客户交付风险清单", "项目", "客户交付", "张三", "P1 高", "等待别人", new Date(2026, 5, 2), 2, 0.35, "等待张三补充风险等级", "是", "是", "", today, "下午 3 点前需要反馈"],
  ["T-003", "审批 Q3 预算初稿", "决策", "预算规划", "我", "P1 高", "未开始", new Date(2026, 5, 5), 1.5, 0, "阅读 Finance 版本", "否", "否", "", today, ""],
  ["T-004", "整理招聘面试反馈", "会议", "招聘面试", "HR", "P2 中", "阻塞", new Date(2026, 4, 30), 1, 0.2, "让 HR 补候选人评分表", "是", "是", "缺少面试官评分", today, "逾期示例"],
  ["T-005", "产品改进项周会纪要", "跟进", "产品改进", "李四", "P2 中", "完成", new Date(2026, 4, 31), 0.5, 1, "归档会议纪要", "否", "是", "", today, ""],
  ["T-006", "梳理跨部门流程 SLA", "项目", "流程优化", "Product", "P1 高", "进行中", new Date(2026, 5, 7), 3, 0.65, "补齐 Legal 审核节点", "否", "是", "", today, ""],
];
const blankRow = Array(taskHeaders.length).fill(null);
const taskRows = [...sampleRows];
while (taskRows.length < 200) taskRows.push([...blankRow]);
tasks.getRange("A6:P205").values = taskRows;
tasks.getRange("H6:H205").setNumberFormat("yyyy-mm-dd");
tasks.getRange("O6:O205").setNumberFormat("yyyy-mm-dd");
tasks.getRange("J6:J205").setNumberFormat("0%");
tasks.getRange("I6:I205").setNumberFormat("0.0");
tasks.tables.add("A5:P205", true, "TasksTable");
tasks.freezePanes.freezeRows(5);
tasks.getRange("C6:C205").dataValidation = { rule: { type: "list", formula1: "'设置'!$C$5:$C$10" } };
tasks.getRange("D6:D205").dataValidation = { rule: { type: "list", formula1: "'设置'!$F$5:$F$14" } };
tasks.getRange("E6:E205").dataValidation = { rule: { type: "list", formula1: "'设置'!$G$5:$G$14" } };
tasks.getRange("F6:F205").dataValidation = { rule: { type: "list", formula1: "'设置'!$B$5:$B$8" } };
tasks.getRange("G6:G205").dataValidation = { rule: { type: "list", formula1: "'设置'!$A$5:$A$11" } };
tasks.getRange("L6:M205").dataValidation = { rule: { type: "list", values: ["是", "否"] } };
addStatusFormats(tasks.getRange("G6:G205"));
tasks.getRange("H6:H205").conditionalFormats.add("expression", {
  formula: '=AND($H6<TODAY(),$G6<>"完成",$B6<>"")',
  format: { fill: { color: "#FEE2E2" }, font: { color: "#991B1B", bold: true } },
});
tasks.getRange("F6:F205").conditionalFormats.add("containsText", {
  text: "P0",
  format: { fill: { color: "#FFE4E6" }, font: { color: "#9F1239", bold: true } },
});
setWidths(tasks, [80, 260, 90, 140, 100, 100, 110, 110, 100, 80, 230, 70, 70, 220, 110, 240]);
tasks.getRange("A5:P205").format.wrapText = true;

// Dashboard
title(dashboard, "A1:M1", "Manager Task OS：每日仪表盘", "每天先看这里：今日任务、逾期、等待别人、阻塞和项目进度。");
dashboard.getRange("A4:B9").values = [
  ["指标", "数量"],
  ["未完成任务", null],
  ["今日/明日到期", null],
  ["已逾期", null],
  ["等待别人", null],
  ["阻塞任务", null],
];
dashboard.getRange("B5:B9").formulas = [
  ['=COUNTIFS(\'任务收集\'!$B$6:$B$205,"<>",\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$G$6:$G$205,"<>取消")'],
  ['=COUNTIFS(\'任务收集\'!$B$6:$B$205,"<>",\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$H$6:$H$205,"<="&TODAY()+1)'],
  ['=COUNTIFS(\'任务收集\'!$B$6:$B$205,"<>",\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$H$6:$H$205,"<"&TODAY())'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,"等待别人")'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,"阻塞")'],
];
styleHeader(dashboard.getRange("A4:B4"));
styleBlock(dashboard.getRange("A4:B9"));
dashboard.getRange("D4:E11").values = [
  ["状态", "数量"],
  ["未开始", null],
  ["进行中", null],
  ["等待别人", null],
  ["阻塞", null],
  ["已安排", null],
  ["完成", null],
  ["取消", null],
];
dashboard.getRange("E5:E11").formulas = [
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D5)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D6)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D7)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D8)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D9)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D10)'],
  ['=COUNTIFS(\'任务收集\'!$G$6:$G$205,D11)'],
];
styleHeader(dashboard.getRange("D4:E4"));
styleBlock(dashboard.getRange("D4:E11"));
dashboard.getRange("G4:H8").values = [
  ["优先级", "未完成"],
  ["P0 紧急", null],
  ["P1 高", null],
  ["P2 中", null],
  ["P3 低", null],
];
dashboard.getRange("H5:H8").formulas = [
  ['=COUNTIFS(\'任务收集\'!$F$6:$F$205,G5,\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$B$6:$B$205,"<>")'],
  ['=COUNTIFS(\'任务收集\'!$F$6:$F$205,G6,\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$B$6:$B$205,"<>")'],
  ['=COUNTIFS(\'任务收集\'!$F$6:$F$205,G7,\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$B$6:$B$205,"<>")'],
  ['=COUNTIFS(\'任务收集\'!$F$6:$F$205,G8,\'任务收集\'!$G$6:$G$205,"<>完成",\'任务收集\'!$B$6:$B$205,"<>")'],
];
styleHeader(dashboard.getRange("G4:H4"));
styleBlock(dashboard.getRange("G4:H8"));
dashboard.getRange("A12:M12").merge();
dashboard.getRange("A12").values = [["今日管理节奏"]];
dashboard.getRange("A12").format.fill = { color: colors.teal };
dashboard.getRange("A12").format.font = { bold: true, color: "#FFFFFF" };
dashboard.getRange("A13:M17").values = [
  ["早上 10 分钟", "清空新增任务、只标记今天要推进的事项"],
  ["午后 10 分钟", "看“委派等待”：催反馈、移除阻塞、补 owner 和 deadline"],
  ["下班前 10 分钟", "更新进度；把未完成的任务改成明确下一步"],
  ["每周一次", "项目页复盘：删除低价值任务，重新排序 Top 3"],
  ["管理原则", "所有任务必须有 owner、状态、截止日期、下一步"],
];
styleBlock(dashboard.getRange("A13:M17"));
const statusChart = dashboard.charts.add("bar", dashboard.getRange("D4:E11"));
statusChart.setPosition("J4", "M11");
statusChart.title = "按状态统计";
statusChart.hasLegend = false;
statusChart.yAxis = { numberFormatCode: "0" };
const priChart = dashboard.charts.add("bar", dashboard.getRange("G4:H8"));
priChart.setPosition("J13", "M22");
priChart.title = "按优先级统计";
priChart.hasLegend = false;
priChart.yAxis = { numberFormatCode: "0" };
setWidths(dashboard, [150, 90, 28, 120, 90, 28, 120, 90, 28, 90, 90, 90, 90]);

// Daily plan
title(daily, "A1:P1", "每日计划", "从“任务收集”筛选今日/明日到期或标记为“今日”的任务；右侧可手工写今日 Top 3。");
daily.getRange("A4:P4").values = [taskHeaders];
styleHeader(daily.getRange("A4:P4"));
const dailyRows = [sampleRows[0], sampleRows[1], sampleRows[3]];
while (dailyRows.length < 26) dailyRows.push([...blankRow]);
daily.getRange("A5:P30").values = dailyRows;
daily.getRange("H5:H30").setNumberFormat("yyyy-mm-dd");
daily.getRange("O5:O30").setNumberFormat("yyyy-mm-dd");
daily.getRange("J5:J30").setNumberFormat("0%");
daily.getRange("R4:T4").values = [["今日 Top 3", "Owner", "下一步"]];
styleHeader(daily.getRange("R4:T4"));
daily.getRange("R5:T7").values = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];
styleBlock(daily.getRange("R4:T7"));
daily.freezePanes.freezeRows(4);
setWidths(daily, [80, 250, 90, 140, 100, 100, 110, 110, 100, 80, 220, 70, 70, 180, 110, 220, 28, 220, 100, 220]);
daily.getRange("A4:T80").format.wrapText = true;
addStatusFormats(daily.getRange("G5:G80"));

// Projects
title(projects, "A1:J1", "团队项目", "每个项目自动统计任务总数、未完成、逾期和完成率。");
projects.getRange("A5:J5").values = [[
  "项目", "目标/说明", "项目Owner", "状态", "下个里程碑", "里程碑日期",
  "任务总数", "未完成", "逾期", "完成率",
]];
styleHeader(projects.getRange("A5:J5"));
const projectRows = [
  ["运营例会", "每周机制稳定运行", "我", "进行中", "本周议题确认", new Date(2026, 5, 3)],
  ["客户交付", "按时交付并降低升级风险", "张三", "等待别人", "风险清单关闭", new Date(2026, 5, 6)],
  ["产品改进", "整理需求并推动版本计划", "李四", "进行中", "需求排序完成", new Date(2026, 5, 10)],
  ["团队管理", "团队优先级和绩效反馈", "我", "进行中", "一对一安排", new Date(2026, 5, 4)],
  ["招聘面试", "关键岗位候选人推进", "HR", "阻塞", "评分表补齐", new Date(2026, 5, 2)],
  ["预算规划", "Q3 预算完成审批", "Finance", "未开始", "初稿审批", new Date(2026, 5, 8)],
  ["流程优化", "跨部门 SLA 透明化", "Product", "进行中", "Legal 节点确认", new Date(2026, 5, 14)],
  ["个人管理", "个人任务清空和复盘", "我", "已安排", "周五 review", new Date(2026, 5, 5)],
  ["跨部门协作", "减少信息反复确认", "我", "未开始", "定义协作清单", new Date(2026, 5, 12)],
  ["风险处理", "快速发现和升级风险", "我", "已安排", "风险模板确认", new Date(2026, 5, 9)],
];
projects.getRange("A6:F15").values = projectRows;
projects.getRange("G6:J15").formulas = projectRows.map((_, i) => {
  const r = 6 + i;
  return [
    `=COUNTIFS('任务收集'!$D$6:$D$205,$A${r},'任务收集'!$B$6:$B$205,"<>")`,
    `=COUNTIFS('任务收集'!$D$6:$D$205,$A${r},'任务收集'!$G$6:$G$205,"<>完成",'任务收集'!$B$6:$B$205,"<>")`,
    `=COUNTIFS('任务收集'!$D$6:$D$205,$A${r},'任务收集'!$G$6:$G$205,"<>完成",'任务收集'!$H$6:$H$205,"<"&TODAY(),'任务收集'!$B$6:$B$205,"<>")`,
    `=IFERROR(COUNTIFS('任务收集'!$D$6:$D$205,$A${r},'任务收集'!$G$6:$G$205,"完成")/G${r},0)`,
  ];
});
projects.getRange("F6:F15").setNumberFormat("yyyy-mm-dd");
projects.getRange("J6:J15").setNumberFormat("0%");
projects.tables.add("A5:J15", true, "ProjectsTable");
projects.freezePanes.freezeRows(5);
addStatusFormats(projects.getRange("D6:D15"));
projects.getRange("I6:I15").conditionalFormats.add("cellIs", {
  operator: "greaterThan",
  formula: 0,
  format: { fill: { color: "#FEE2E2" }, font: { color: "#991B1B", bold: true } },
});
setWidths(projects, [150, 260, 110, 110, 190, 110, 90, 90, 80, 90]);
projects.getRange("A5:J15").format.wrapText = true;

// Delegated / waiting
title(waiting, "A1:P1", "委派等待", "集中跟进委派事项、等待别人、阻塞任务；适合 manager 每天中午检查。");
waiting.getRange("A4:P4").values = [taskHeaders];
styleHeader(waiting.getRange("A4:P4"));
const waitingRows = [sampleRows[1], sampleRows[3], sampleRows[5]];
while (waitingRows.length < 26) waitingRows.push([...blankRow]);
waiting.getRange("A5:P30").values = waitingRows;
waiting.freezePanes.freezeRows(4);
addStatusFormats(waiting.getRange("G5:G80"));
waiting.getRange("H5:H80").setNumberFormat("yyyy-mm-dd");
waiting.getRange("J5:J80").setNumberFormat("0%");
setWidths(waiting, [80, 250, 90, 140, 100, 100, 110, 110, 100, 80, 220, 70, 70, 180, 110, 220]);
waiting.getRange("A4:P80").format.wrapText = true;

// Common body styles
for (const sheet of [tasks, daily, projects, waiting, settings, dashboard]) {
  const used = sheet.getUsedRange();
  used.format.font = { name: "Aptos", color: colors.text, size: 10 };
}
// Restore title visual after global font assignment.
for (const [sheet, range] of [[dashboard, "A1:M1"], [tasks, "A1:P1"], [daily, "A1:P1"], [projects, "A1:J1"], [waiting, "A1:P1"], [settings, "A1:H1"]]) {
  sheet.getRange(range).format.fill = { color: colors.navy };
  sheet.getRange(range).format.font = { name: "Aptos Display", bold: true, color: "#FFFFFF", size: 18 };
}

// Verification snippets.
const checks = [
  await wb.inspect({ kind: "table", range: "仪表盘!A4:H11", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 8, maxChars: 3000 }),
  await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "formula error scan", maxChars: 2000 }),
];
for (const check of checks) console.log(check.ndjson);

await fs.mkdir(outputDir, { recursive: true });
for (const sheetName of ["仪表盘", "任务收集", "每日计划", "团队项目", "委派等待", "设置"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(`${outputDir}/${sheetName}.png`, bytes);
}
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(outputPath);
