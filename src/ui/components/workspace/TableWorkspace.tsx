import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TableWorkspaceProps {
  content: string;
  showChart?: boolean;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

const TableWorkspace: React.FC<TableWorkspaceProps> = ({ content, showChart = false }) => {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [activeTab, setActiveTab] = useState<"table" | "chart">(showChart ? "chart" : "table");

  const tables = useMemo(() => parseMarkdownTables(content), [content]);

  if (tables.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        <pre className="whitespace-pre-wrap font-mono text-xs">{content}</pre>
      </div>
    );
  }

  const primaryTable = tables[0];
  const chartData = buildChartData(primaryTable);
  const hasNumericData = chartData.some((row) =>
    Object.values(row).some((v) => typeof v === "number")
  );

  return (
    <div className="rounded-b-lg overflow-hidden">
      {/* Tab bar */}
      {showChart && hasNumericData && (
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-900/30 border-b border-gray-700/50">
          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === "table"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setActiveTab("chart")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === "chart"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Chart
          </button>
          {activeTab === "chart" && (
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setChartType("bar")}
                className={`px-2 py-1 text-xs rounded ${chartType === "bar" ? "bg-gray-600" : "text-gray-500 hover:bg-gray-700"}`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType("line")}
                className={`px-2 py-1 text-xs rounded ${chartType === "line" ? "bg-gray-600" : "text-gray-500 hover:bg-gray-700"}`}
              >
                Line
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table view */}
      {activeTab === "table" && (
        <div className="overflow-x-auto">
          {tables.map((table, tableIdx) => (
            <table key={tableIdx} className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-800/80">
                  {table.headers.map((header, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`border-b border-gray-800 ${
                      rowIdx % 2 === 0 ? "bg-gray-900/20" : "bg-gray-900/40"
                    } hover:bg-gray-700/30 transition-colors`}
                  >
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-gray-300">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}

      {/* Chart view */}
      {activeTab === "chart" && hasNumericData && (
        <div className="p-4 bg-gray-900/20">
          <ResponsiveContainer width="100%" height={300}>
            {chartType === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#F9FAFB" }}
                />
                <Legend />
                {getNumericKeys(chartData).map((key, i) => (
                  <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#F9FAFB" }}
                />
                <Legend />
                {getNumericKeys(chartData).map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const CHART_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

function parseMarkdownTables(content: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|")) {
      const headers = line
        .split("|")
        .map((h) => h.trim())
        .filter((h) => h);

      if (headers.length > 0) {
        const rows: string[][] = [];
        i++;

        // Skip separator line
        if (i < lines.length && lines[i].match(/^[\s|:-]+$/)) {
          i++;
        }

        while (i < lines.length && lines[i].includes("|")) {
          const row = lines[i]
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c);
          if (row.length > 0) rows.push(row);
          i++;
        }

        if (rows.length > 0) {
          tables.push({ headers, rows });
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return tables;
}

function buildChartData(table: ParsedTable): Array<Record<string, string | number>> {
  return table.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    table.headers.forEach((header, i) => {
      const val = row[i] || "";
      const num = parseFloat(val.replace(/[,%$]/g, ""));
      obj[header] = isNaN(num) ? val : num;
    });
    // Use first column as name
    obj.name = String(row[0] || "");
    return obj;
  });
}

function getNumericKeys(data: Array<Record<string, string | number>>): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter(
    (key) => key !== "name" && typeof data[0][key] === "number"
  );
}

export default TableWorkspace;
