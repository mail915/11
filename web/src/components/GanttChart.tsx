import { useMemo, useState } from "react";
import { Task, TaskStatus } from "../api/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 32;

const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
};
// Fixed categorical order, never cycled or reassigned per-render.
const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "#64748b",
  IN_PROGRESS: "#0ea5e9",
  DONE: "#22c55e",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtShort(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

interface Bar {
  task: Task;
  startOffset: number; // days from chart start
  durationDays: number;
}

export default function GanttChart({ tasks }: { tasks: Task[] }) {
  const [hovered, setHovered] = useState<{ bar: Bar; x: number; y: number } | null>(null);

  const { bars, chartStart, totalDays, monthMarks, todayOffset } = useMemo(() => {
    if (tasks.length === 0) {
      return { bars: [] as Bar[], chartStart: new Date(), totalDays: 0, monthMarks: [], todayOffset: null as number | null };
    }

    const withDates = tasks.map((t) => {
      const fallbackStart = t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
      const start = startOfDay(fallbackStart);
      const rawEnd = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + 3 * DAY_MS);
      const end = startOfDay(rawEnd) < start ? start : startOfDay(rawEnd);
      return { task: t, start, end };
    });

    const minStart = new Date(Math.min(...withDates.map((t) => t.start.getTime())));
    const maxEnd = new Date(Math.max(...withDates.map((t) => t.end.getTime())));
    const chartStart = new Date(minStart.getTime() - 2 * DAY_MS);
    const chartEnd = new Date(maxEnd.getTime() + 2 * DAY_MS);
    const totalDays = Math.max(1, Math.round((chartEnd.getTime() - chartStart.getTime()) / DAY_MS));

    const bars: Bar[] = withDates.map(({ task, start, end }) => ({
      task,
      startOffset: Math.round((start.getTime() - chartStart.getTime()) / DAY_MS),
      durationDays: Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1),
    }));

    const monthMarks: { offset: number; label: string }[] = [];
    const cursor = new Date(chartStart);
    cursor.setDate(1);
    if (cursor < chartStart) cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= chartEnd) {
      monthMarks.push({
        offset: Math.round((cursor.getTime() - chartStart.getTime()) / DAY_MS),
        label: cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const today = startOfDay(new Date());
    const todayOffset =
      today >= chartStart && today <= chartEnd ? Math.round((today.getTime() - chartStart.getTime()) / DAY_MS) : null;

    return { bars, chartStart, totalDays, monthMarks, todayOffset };
  }, [tasks]);

  if (tasks.length === 0) {
    return <p className="muted">Нет задач для отображения на диаграмме.</p>;
  }

  return (
    <div className="gantt-root">
      <div className="gantt-legend">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="gantt-legend-item">
            <span className="gantt-legend-swatch" style={{ background: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="gantt-scroll">
        <div className="gantt-chart" style={{ width: totalDays * DAY_WIDTH + 220 }}>
          <div className="gantt-header" style={{ marginLeft: 220 }}>
            {monthMarks.map((m) => (
              <div key={m.offset} className="gantt-month-mark" style={{ left: m.offset * DAY_WIDTH }}>
                {m.label}
              </div>
            ))}
          </div>

          <div className="gantt-body">
            {todayOffset !== null && (
              <div
                className="gantt-today-line"
                style={{ left: 220 + todayOffset * DAY_WIDTH }}
                title="Сегодня"
              />
            )}
            {bars.map((bar) => (
              <div className="gantt-row" key={bar.task.id}>
                <div className="gantt-row-label" title={bar.task.title}>
                  {bar.task.title}
                </div>
                <div
                  className="gantt-bar"
                  style={{
                    left: 220 + bar.startOffset * DAY_WIDTH,
                    width: Math.max(DAY_WIDTH - 4, bar.durationDays * DAY_WIDTH - 4),
                    background: STATUS_COLOR[bar.task.status],
                  }}
                  onMouseEnter={(e) => setHovered({ bar, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHovered({ bar, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHovered(null)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {hovered && (
        <div className="gantt-tooltip" style={{ left: hovered.x + 12, top: hovered.y + 12 }}>
          <strong>{hovered.bar.task.title}</strong>
          <div className="muted small">{STATUS_LABEL[hovered.bar.task.status]}</div>
          <div className="muted small">
            {fmtShort(new Date(chartStart.getTime() + hovered.bar.startOffset * DAY_MS))} –{" "}
            {fmtShort(new Date(chartStart.getTime() + (hovered.bar.startOffset + hovered.bar.durationDays - 1) * DAY_MS))}
          </div>
          {hovered.bar.task.assignee && <div className="muted small">👤 {hovered.bar.task.assignee.name}</div>}
        </div>
      )}
    </div>
  );
}
