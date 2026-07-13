"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Chart,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
} from "chart.js";

Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip
);


type UserRow = {
    name: string;
    level: number;
    xp: number;
    streak: number;
    sessions: number;
    lastActiveHours: number;
    tier: string;
};



function getTierName(level: number) {
    if (level <= 10) return "Iron";
    if (level <= 20) return "Bronze";
    if (level <= 32) return "Steel";
    if (level <= 45) return "Silver";
    return "Mythril";
}

const TIER_COLORS: Record<string, string> = {
    Iron: "var(--iron)",
    Bronze: "var(--bronze)",
    Steel: "var(--steel)",
    Silver: "var(--silver)",
    Mythril: "var(--mythril)",
};

function initials(name: string) {
    return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function fmtNum(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return Math.round(n).toString();
}

function timeAgo(hours: number) {
    if (hours < 1) return "just now";
    if (hours < 24) return hours + "h ago";
    const d = Math.floor(hours / 24);
    return d + "d ago";
}

const BANDS: [number, number, string][] = [
    [1, 10, "Iron"],
    [11, 20, "Bronze"],
    [21, 32, "Steel"],
    [33, 45, "Silver"],
    [46, 60, "Mythril"],
];

type ViewKey = "overview" | "leaderboard" | "users" | "activity";

const NAV_ITEMS: { key: ViewKey; label: string; icon: JSX.Element }[] = [
    {
        key: "overview",
        label: "Overview",
        icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
        ),
    },
    {
        key: "leaderboard",
        label: "Leaderboard",
        icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
                <path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />
            </svg>
        ),
    },
    {
        key: "users",
        label: "All users",
        icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        key: "activity",
        label: "Activity",
        icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        ),
    },
];

export default function BrainForgeDashboard() {
    const [pin, setPin] = useState("");
    const [activeView, setActiveView] = useState<ViewKey>("overview");
    const [search, setSearch] = useState("");

    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        async function loadDashboard() {

            const res = await fetch(
                "/api/admin/dashboard",
                {
                    cache: "no-store"
                }
            );

            const data = await res.json();


            if (data.users) {

                const formatted = data.users.map((u: any) => ({

                    name: u.full_name ?? u.username,

                    level: Math.floor(u.xp / 500),

                    xp: u.xp,

                    streak: u.streak,

                    sessions: 0,

                    lastActiveHours: 0,

                    tier: getTierName(
                        Math.floor(u.xp / 500)
                    )
                }));
                setUsers(formatted);
            }
            setLoading(false);
        }
        loadDashboard();
    }, []);

    const totalUsers = users.length;
    const activeNow = users.filter((u) => u.lastActiveHours < 24).length;
    const avgLevel = (users.reduce((s, u) => s + u.level, 0) / users.length).toFixed(1);
    const totalXP = users.reduce((s, u) => s + u.xp, 0);
    const engagementPct =
        totalUsers === 0
            ? 0
            : Math.round(
                (users.filter((u) => u.lastActiveHours < 168).length /
                    totalUsers) *
                100
            );

    const mostActive = useMemo(
        () => [...users].sort((a, b) => b.sessions - a.sessions).slice(0, 5),
        [users]
    );
    const maxSessions = mostActive[0]?.sessions || 1;

    const bandCounts = useMemo(
        () => BANDS.map(([lo, hi]) => users.filter((u) => u.level >= lo && u.level <= hi).length),
        [users]
    );

    // 14-day activity series — generated once with its own seeded rand so it's stable.
    const activitySeries = useMemo(() => {
        const labels: string[] = [];
        const days: number[] = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(
                d.getDate() - i
            );
            labels.push(
                `${d.getMonth() + 1}/${d.getDate()}`
            );
            days.push(0);
        }
        return {
            labels,
            days
        };
    }, []);

    const filteredUsers = useMemo(
        () => users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())),
        [users, search]
    );

    /* ---------------- Chart.js (client-only, canvas refs) ---------------- */

    const levelCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activityCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const levelChartRef = useRef<Chart | null>(null);
    const activityChartRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (levelCanvasRef.current) {
            levelChartRef.current?.destroy();
            levelChartRef.current = new Chart(levelCanvasRef.current, {
                type: "bar",
                data: {
                    labels: BANDS.map(([lo, hi, name]) => `${name} (${lo}-${hi})`),
                    datasets: [
                        {
                            data: bandCounts,
                            backgroundColor: "#E8862E",
                            borderRadius: 4,
                            maxBarThickness: 40,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: "#B0A28A", font: { size: 11 } }, grid: { display: false } },
                        y: {
                            ticks: { color: "#B0A28A", font: { size: 11 } },
                            grid: { color: "#2A2216" },
                            beginAtZero: true,
                        },
                    },
                },
            });
        }
        return () => {
            levelChartRef.current?.destroy();
            levelChartRef.current = null;
        };
    }, [bandCounts]);

    useEffect(() => {
        if (activityCanvasRef.current) {
            activityChartRef.current?.destroy();
            activityChartRef.current = new Chart(activityCanvasRef.current, {
                type: "line",
                data: {
                    labels: activitySeries.labels,
                    datasets: [
                        {
                            data: activitySeries.days,
                            borderColor: "#57D9C7",
                            backgroundColor: "rgba(87,217,199,0.1)",
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                            pointBackgroundColor: "#57D9C7",
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: "#B0A28A", font: { size: 11 } }, grid: { display: false } },
                        y: {
                            ticks: { color: "#B0A28A", font: { size: 11 } },
                            grid: { color: "#2A2216" },
                            beginAtZero: true,
                        },
                    },
                },
            });
        }
        return () => {
            activityChartRef.current?.destroy();
            activityChartRef.current = null;
        };
    }, [activitySeries]);


    const gauge = useMemo(() => {
        const r = 48;
        const circumference = 2 * Math.PI * r * 0.75;
        const offset = circumference * (1 - engagementPct / 100);
        return { r, circumference, offset };
    }, [engagementPct]);


    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/admin";
    };

    return (
        <div className="bf-root">
            <div className="sidebar">
                <div className="brand">
                    Brain Forge <span>AI DevOp</span>
                </div>
                <div className="brand-sub">DEV CONSOLE</div>

                {NAV_ITEMS.map((item) => (
                    <div
                        key={item.key}
                        className={`nav-item${activeView === item.key ? " active" : ""}`}
                        onClick={() => setActiveView(item.key)}
                    >
                        {item.icon}
                        {item.label}
                    </div>
                ))}

                <div className="sidebar-foot">
                    v0.9.1 · demo data
                    <br />
                    last synced just now
                </div>
            </div>

            <div className="main">

                <div className="flex justify-end mb-5">
                    <button
                        onClick={handleLogout}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition">
                        Logout
                    </button>
                </div>
                {activeView === "overview" && (
                    <div className="view active">
                        <div className="page-header">
                            <div>
                                <div className="page-title">Overview</div>
                                <div className="page-desc">System-wide snapshot of your forge</div>
                            </div>
                        </div>

                        <div className="stat-row">
                            <div className="stat-card">
                                <div className="stat-label">Total users</div>
                                <div className="stat-value mono">{totalUsers}</div>
                                <div className="stat-delta">+4 this week</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Active last 24h</div>
                                <div className="stat-value mono">{activeNow}</div>
                                <div className="stat-delta">{Math.round((activeNow / totalUsers) * 100)}% of base</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Avg level</div>
                                <div className="stat-value mono">{avgLevel}</div>
                                <div className="stat-delta down">-0.3 vs last wk</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total XP forged</div>
                                <div className="stat-value mono">{fmtNum(totalXP)}</div>
                                <div className="stat-delta">+{fmtNum(totalXP * 0.06)} this week</div>
                            </div>
                        </div>

                        <div className="panel-row">
                            <div className="panel">
                                <div className="panel-title">
                                    Engagement heat <small>7-day rolling</small>
                                </div>
                                <div className="gauge-wrap">
                                    <svg width={120} height={120} viewBox="0 0 120 120">
                                        <circle
                                            cx={60}
                                            cy={60}
                                            r={gauge.r}
                                            fill="none"
                                            stroke="#3E3220"
                                            strokeWidth={10}
                                            strokeDasharray={`${gauge.circumference} ${2 * Math.PI * gauge.r}`}
                                            strokeDashoffset={0}
                                            transform="rotate(135 60 60)"
                                            strokeLinecap="round"
                                        />
                                        <circle
                                            cx={60}
                                            cy={60}
                                            r={gauge.r}
                                            fill="none"
                                            stroke="#E8862E"
                                            strokeWidth={10}
                                            strokeDasharray={`${gauge.circumference} ${2 * Math.PI * gauge.r}`}
                                            strokeDashoffset={gauge.offset}
                                            transform="rotate(135 60 60)"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="gauge-readout">
                                        <div className="gauge-num">{engagementPct}%</div>
                                        <div className="gauge-label">users active in last 7 days</div>
                                    </div>
                                </div>
                            </div>

                            <div className="panel">
                                <div className="panel-title">
                                    Most active right now <small>by sessions this week</small>
                                </div>
                                <div className="active-list">
                                    {mostActive.map((u, i) => (
                                        <div className="active-row" key={u.name}>
                                            <div className="active-rank">{i + 1}</div>
                                            <div className="avatar">{initials(u.name)}</div>
                                            <div style={{ flex: 1 }}>
                                                <div className="active-name">{u.name}</div>
                                                <div className="bar-track">
                                                    <div
                                                        className="bar-fill"
                                                        style={{ width: `${Math.round((u.sessions / maxSessions) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="active-meta">{u.sessions} sess/wk</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="panel">
                            <div className="panel-title">
                                Level distribution <small>users per tier band</small>
                            </div>
                            <div className="chart-wrap" style={{ height: 220 }}>
                                <canvas ref={levelCanvasRef} role="img" aria-label="Bar chart of number of users per level band" />
                            </div>
                        </div>
                    </div>
                )}

                {activeView === "leaderboard" && (
                    <div className="view active">
                        <div className="page-header">
                            <div>
                                <div className="page-title">Leaderboard</div>
                                <div className="page-desc">Ranked by total XP forged</div>
                            </div>
                        </div>
                        <div className="panel table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>Rank</th>
                                        <th>User</th>
                                        <th>Tier</th>
                                        <th>Level</th>
                                        <th>XP</th>
                                        <th>Streak</th>
                                        <th>Last active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u, i) => {
                                        const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
                                        return (
                                            <tr key={u.name}>
                                                <td>
                                                    <span className={`rank-badge mono ${rankClass}`}>{i + 1}</span>
                                                </td>
                                                <td>
                                                    <div className="user-cell">
                                                        <div className="avatar">{initials(u.name)}</div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className="tier-pill"
                                                        style={{
                                                            color: TIER_COLORS[u.tier],
                                                            borderColor: `color-mix(in srgb, ${TIER_COLORS[u.tier]} 27%, transparent)`,
                                                            background: `color-mix(in srgb, ${TIER_COLORS[u.tier]} 8%, transparent)`,
                                                        }}
                                                    >
                                                        {u.tier}
                                                    </span>
                                                </td>
                                                <td className="mono">Lv {u.level}</td>
                                                <td className="mono">{fmtNum(u.xp)}</td>
                                                <td className="mono">{u.streak}d</td>
                                                <td className="mono" style={{ color: "var(--text-faint)" }}>
                                                    {timeAgo(u.lastActiveHours)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeView === "users" && (
                    <div className="view active">
                        <div className="page-header">
                            <div>
                                <div className="page-title">All users</div>
                                <div className="page-desc">
                                    {filteredUsers.length} of {users.length} users
                                </div>
                            </div>
                            <input
                                className="search-box"
                                placeholder="Search by name…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="panel table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Tier</th>
                                        <th>Level</th>
                                        <th>XP</th>
                                        <th>Streak</th>
                                        <th>Sessions/wk</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u) => {
                                        const online = u.lastActiveHours < 1;
                                        return (
                                            <tr key={u.name}>
                                                <td>
                                                    <div className="user-cell">
                                                        <div className="avatar">{initials(u.name)}</div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className="tier-pill"
                                                        style={{
                                                            color: TIER_COLORS[u.tier],
                                                            borderColor: `color-mix(in srgb, ${TIER_COLORS[u.tier]} 27%, transparent)`,
                                                            background: `color-mix(in srgb, ${TIER_COLORS[u.tier]} 8%, transparent)`,
                                                        }}
                                                    >
                                                        {u.tier}
                                                    </span>
                                                </td>
                                                <td className="mono">Lv {u.level}</td>
                                                <td className="mono">{fmtNum(u.xp)}</td>
                                                <td className="mono">{u.streak}d</td>
                                                <td className="mono">{u.sessions}</td>
                                                <td>
                                                    <span className={`status-dot ${online ? "online" : "offline"}`} />
                                                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                                                        {online ? "online" : timeAgo(u.lastActiveHours)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeView === "activity" && (
                    <div className="view active">
                        <div className="page-header">
                            <div>
                                <div className="page-title">Activity</div>
                                <div className="page-desc">Daily active users, last 14 days</div>
                            </div>
                        </div>
                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="chart-wrap" style={{ height: 260 }}>
                                <canvas
                                    ref={activityCanvasRef}
                                    role="img"
                                    aria-label="Line chart of daily active users over the last 14 days"
                                />
                            </div>
                        </div>
                        <div className="panel">
                            <div className="panel-title">
                                Ideas for what to add next <small>not wired up yet</small>
                            </div>
                            <ul className="note-list">
                                <li>Retention cohorts — % of users still active 1/7/30 days after signup, grouped by signup week</li>
                                <li>Churn alerts — flag users whose streak just broke or who dropped 2+ levels in activity</li>
                                <li>Session depth — avg minutes per session and drop-off point inside a session</li>
                                <li>Content/skill heatmap — which brain-training modules get replayed vs abandoned</li>
                                <li>Cohort vs cohort — compare this week&apos;s new signups against last week&apos;s on day-1 activation</li>
                                <li>Admin actions log — audit trail for manual level/XP overrides you make from this dashboard</li>
                                <li>Push/notification impact — activity lift after a reminder notification goes out</li>
                                <li>Export CSV — one-click export of the leaderboard or full user table for reporting</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
        .bf-root {
          --bg: #161209;
          --surface: #201a11;
          --surface-2: #2a2216;
          --surface-3: #352a19;
          --border: #3e3220;
          --border-strong: #544a30;
          --text: #f3ecdc;
          --text-dim: #b0a28a;
          --text-faint: #7a6f5b;
          --ember: #e8862e;
          --ember-bright: #ffb454;
          --ember-dim: #5c3a1b;
          --neural: #57d9c7;
          --neural-dim: #1f4b44;
          --iron: #9aa0a6;
          --bronze: #c87f4a;
          --steel: #7fa6c9;
          --silver: #d8dce2;
          --mythril: #b98ce8;
          --danger: #e8602e;

          font-family: "Inter", sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          display: flex;
        }
        .mono {
          font-family: "IBM Plex Mono", monospace;
        }

        .sidebar {
          width: 220px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }
        .brand {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: var(--text);
          margin-bottom: 2px;
          letter-spacing: 0.2px;
        }
        .brand span {
          color: var(--ember);
        }
        .brand-sub {
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
          color: var(--text-faint);
          margin-bottom: 28px;
          letter-spacing: 0.5px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 14px;
          color: var(--text-dim);
          cursor: pointer;
          border: 1px solid transparent;
          user-select: none;
        }
        .nav-item:hover {
          background: var(--surface-2);
          color: var(--text);
        }
        .nav-item.active {
          background: var(--surface-2);
          color: var(--ember-bright);
          border-color: var(--border);
        }
        .nav-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .sidebar-foot {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--text-faint);
          font-family: "IBM Plex Mono", monospace;
          line-height: 1.6;
        }

        .main {
          flex: 1;
          padding: 28px 36px 60px;
          max-width: 1200px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .page-title {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          font-size: 24px;
        }
        .page-desc {
          color: var(--text-dim);
          font-size: 13px;
          margin-top: 4px;
        }
        .search-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text);
          font-size: 13px;
          font-family: "Inter", sans-serif;
          width: 220px;
          outline: none;
        }
        .search-box::placeholder {
          color: var(--text-faint);
        }
        .search-box:focus {
          border-color: var(--ember-dim);
        }

        .stat-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px 18px;
        }
        .stat-label {
          font-size: 11px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 8px;
        }
        .stat-value {
          font-family: "IBM Plex Mono", monospace;
          font-size: 26px;
          font-weight: 600;
        }
        .stat-delta {
          font-size: 12px;
          color: var(--neural);
          margin-top: 4px;
        }
        .stat-delta.down {
          color: var(--danger);
        }

        .panel-row {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 18px 20px;
        }
        .panel-title {
          font-family: "Space Grotesk", sans-serif;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .panel-title small {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          color: var(--text-faint);
          font-weight: 400;
        }

        .gauge-wrap {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .gauge-num {
          font-family: "IBM Plex Mono", monospace;
          font-size: 34px;
          font-weight: 600;
          color: var(--ember-bright);
        }
        .gauge-label {
          font-size: 12px;
          color: var(--text-dim);
          margin-top: 2px;
        }

        .active-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .active-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .active-rank {
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
          color: var(--text-faint);
          width: 16px;
        }
        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--surface-3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--ember-bright);
          flex-shrink: 0;
        }
        .active-name {
          font-size: 13px;
          flex: 1;
        }
        .active-meta {
          font-size: 11px;
          color: var(--text-faint);
          font-family: "IBM Plex Mono", monospace;
        }
        .bar-track {
          height: 5px;
          background: var(--surface-3);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 4px;
        }
        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--ember-dim), var(--ember));
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th {
          text-align: left;
          padding: 8px 10px;
          color: var(--text-faint);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border);
          user-select: none;
        }
        td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--border);
        }
        tr:last-child td {
          border-bottom: none;
        }
        tr:hover td {
          background: var(--surface-2);
        }

        .rank-badge {
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
          width: 22px;
          height: 22px;
          border-radius: 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-dim);
          background: var(--surface-2);
        }
        .rank-1 {
          background: #3a2e12;
          color: #f4c542;
        }
        .rank-2 {
          background: #2c2e32;
          color: #d8dce2;
        }
        .rank-3 {
          background: #3a2515;
          color: #c87f4a;
        }

        .tier-pill {
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          display: inline-block;
          border: 1px solid;
        }
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
        }
        .online {
          background: var(--neural);
        }
        .offline {
          background: var(--text-faint);
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chart-wrap {
          position: relative;
          width: 100%;
        }

        .note-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 13px;
          color: var(--text-dim);
        }
        .note-list li {
          list-style: none;
          padding-left: 16px;
          position: relative;
        }
        .note-list li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: var(--ember);
        }

        /* =========================
   RESPONSIVE DESIGN
========================= */

@media (max-width: 900px) {

  .bf-root {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    padding: 12px;
    gap: 8px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .brand,
  .brand-sub,
  .sidebar-foot {
    display: none;
  }

  .nav-item {
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 12px;
  }

  .main {
    width: 100%;
    padding: 20px 14px 40px;
    max-width: none;
  }

  .page-header {
    flex-direction: column;
    gap: 15px;
  }

  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .panel-row {
    grid-template-columns: 1fr;
  }

}


@media (max-width: 600px) {

  .stat-row {
    grid-template-columns: 1fr;
  }


  .page-title {
    font-size: 20px;
  }


  .stat-value {
    font-size: 22px;
  }


  .panel {
    padding: 14px;
    overflow: hidden;
  }


  .gauge-wrap {
    flex-direction: column;
    align-items: flex-start;
  }


  .search-box {
    width: 100%;
  }


  /* TABLE RESPONSIVE */

  .panel table {
    min-width: 750px;
  }

  .panel {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }


  table {
    font-size: 12px;
  }

  th,
  td {
    padding: 8px;
    white-space: nowrap;
  }


  .active-row {
    flex-wrap: wrap;
  }


  .chart-wrap {
    min-height: 200px;
  }


  canvas {
    max-width: 100%;
  }

}


/* extra small phones */
@media (max-width: 380px) {

  .nav-item {
    padding: 7px 10px;
  }

  .main {
    padding: 15px 10px;
  }

  .stat-card {
    padding: 14px;
  }

}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
      `}</style>
        </div>
    );
}