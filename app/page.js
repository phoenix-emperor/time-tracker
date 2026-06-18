"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getTasks, createTask, deleteTask, createSession, endSession, getSessionsForTask, addManualSession, updateSession, deleteSession, getAllSessions } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const AVAILABLE_EMOJIS = ["🕒", "🚀", "💻", "📚", "🎨", "🎵", "🏋️", "🧘", "🔧", "🍳", "🎮", "📝", "📊", "📞", "🤝", "💡"];

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  
  // Add task state
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskEmoji, setNewTaskEmoji] = useState("🕒");
  const [isAdding, setIsAdding] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Timer state
  const [timerStatus, setTimerStatus] = useState("idle");
  const [sessionId, setSessionId] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null); 
  const elapsedOffsetRef = useRef(0);

  // Sessions and stats state
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, year: 0 });
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Chart state
  const [lookbackDays, setLookbackDays] = useState(7); 
  const lookbackOptions = [
    { label: "7 Days", value: 7 },
    { label: "30 Days", value: 30 },
    { label: "3 Months", value: 90 },
    { label: "6 Months", value: 180 },
    { label: "1 Year", value: 365 },
    { label: "All Time", value: 'all' },
  ];

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [modalSessionId, setModalSessionId] = useState(null);
  const [modalDatetime, setModalDatetime] = useState("");
  const [modalDuration, setModalDuration] = useState("");

  useEffect(() => {
    async function loadTasks() {
      setIsLoadingTasks(true);
      try {
        const data = await getTasks();
        setTasks(data || []);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setIsLoadingTasks(false);
      }
    }
    loadTasks();
  }, []);

  const calculateStats = useCallback((sessionList) => {
    const now = new Date();
    let d_today = 0, d_week = 0, d_month = 0, d_year = 0;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    sessionList.forEach(s => {
      if (!s.duration_ms) return;
      const sDate = new Date(s.started_at);
      const ms = s.duration_ms;
      
      if (sDate.toDateString() === now.toDateString()) d_today += ms;
      if (sDate >= startOfWeek) d_week += ms;
      if (sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear()) d_month += ms;
      if (sDate.getFullYear() === now.getFullYear()) d_year += ms;
    });
    
    setStats({
      today: d_today,
      week: d_week,
      month: d_month,
      year: d_year
    });
  }, []);

  const loadSessions = useCallback(async (taskId) => {
    if (!taskId) return;
    setIsLoadingSessions(true);
    try {
      const data = await getSessionsForTask(taskId);
      const validSessions = data || [];
      setSessions(validSessions);
      calculateStats(validSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    if (selectedTask) {
      loadSessions(selectedTask.id);
    } else {
      setSessions([]);
      async function fetchAll() {
        setIsLoadingSessions(true);
        try {
          const data = await getAllSessions();
          const valid = data || [];
          setAllSessions(valid);
          calculateStats(valid);
        } catch (e) {
          console.error("Error fetching all sessions", e);
        } finally {
          setIsLoadingSessions(false);
        }
      }
      fetchAll();
    }
  }, [selectedTask, loadSessions, calculateStats]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setIsAdding(true);
    try {
      const task = await createTask(newTaskName.trim(), newTaskEmoji);
      setTasks((prev) => [...prev, task]);
      setNewTaskName("");
      setNewTaskEmoji("🕒");
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTask = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this task? All tracking history will be permanently lost.")) return;
    
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTask?.id === id) {
        if (timerStatus !== "idle") {
          clearInterval(timerRef.current);
          setTimerStatus("idle");
          setElapsedMs(0);
          setSessionId(null);
        }
        setSelectedTask(null);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete the task. Please check your connection.");
    }
  };

  const selectTask = (task) => {
    if (timerStatus !== "idle") {
      alert("Please stop the current timer before switching tasks.");
      return;
    }
    setSelectedTask(task);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const formatDurationMs = (ms) => {
    if (!ms) return "0m";
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes === 0) return `${totalSeconds}s`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      if (minutes > 0) return `${hours}h ${minutes}m`;
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const processChartData = (sessionsData, isCumulative) => {
    if (!sessionsData) return [];
    
    let startDate = new Date();
    startDate.setHours(0,0,0,0);
    
    if (lookbackDays !== 'all') {
      startDate.setDate(startDate.getDate() - (lookbackDays - 1));
    } else {
      if (sessionsData.length > 0) {
        // sessions are sorted by started_at descending, so last is earliest
        const earliestStr = sessionsData[sessionsData.length-1].started_at;
        const earliest = new Date(earliestStr);
        startDate.setTime(earliest.getTime());
        startDate.setHours(0,0,0,0);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }
    }

    const dataByDate = {};
    
    if (lookbackDays <= 30 && lookbackDays !== 'all') {
      for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toDateString();
        dataByDate[key] = { 
          date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), 
          timestamp: d.getTime()
        };
      }
    }

    sessionsData.forEach(s => {
      const sDate = new Date(s.started_at);
      if (sDate < startDate && lookbackDays !== 'all') return;
      
      sDate.setHours(0,0,0,0);
      const key = sDate.toDateString();

      if (!dataByDate[key]) {
         dataByDate[key] = { 
           date: sDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
           timestamp: sDate.getTime()
         };
      }
      
      const hours = s.duration_ms ? s.duration_ms / 3600000 : 0;
      
      if (isCumulative) {
        const taskName = s.tasks?.name ? `${s.tasks.emoji} ${s.tasks.name}` : "Deleted Task";
        if (!dataByDate[key][taskName]) dataByDate[key][taskName] = 0;
        dataByDate[key][taskName] += hours;
      } else {
        if (!dataByDate[key]['Hours']) dataByDate[key]['Hours'] = 0;
        dataByDate[key]['Hours'] += hours;
      }
    });

    return Object.values(dataByDate).sort((a, b) => a.timestamp - b.timestamp);
  }

  const chartData = selectedTask ? processChartData(sessions, false) : processChartData(allSessions, true);
  
  const formatTooltip = (value) => {
    const hrs = Math.floor(value);
    const mins = Math.round((value - hrs) * 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const uniqueTasksForChart = Array.from(new Set(allSessions.map(s => s.tasks?.name ? `${s.tasks.emoji} ${s.tasks.name}` : "Deleted Task")));
  const COLORS = ['#5e6ad2', '#82ca9d', '#ffc658', '#f25c54', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1', '#f4a362', '#da70d6'];
  const chartColors = {};
  uniqueTasksForChart.forEach((task, idx) => {
    chartColors[task] = COLORS[idx % COLORS.length];
  });

  const handleStart = async () => {
    if (!selectedTask) return;
    
    try {
      const now = new Date();
      if (timerStatus === "idle") {
        const sid = await createSession(selectedTask.id, now.toISOString());
        setSessionId(sid);
        elapsedOffsetRef.current = 0;
        setElapsedMs(0);
      }
      
      startTimeRef.current = Date.now();
      setTimerStatus("running");
      
      timerRef.current = setInterval(() => {
        const currentElapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsedOffsetRef.current + currentElapsed);
      }, 1000);
    } catch (error) {
      console.error("Error starting session:", error);
    }
  };

  const handlePause = () => {
    if (timerStatus === "running") {
      clearInterval(timerRef.current);
      const currentElapsed = Date.now() - startTimeRef.current;
      elapsedOffsetRef.current += currentElapsed;
      setTimerStatus("paused");
    }
  };

  const handleStop = async () => {
    if (timerStatus === "idle") return;
    
    clearInterval(timerRef.current);
    
    let finalElapsed = elapsedOffsetRef.current;
    if (timerStatus === "running") {
      finalElapsed += (Date.now() - startTimeRef.current);
    }
    
    setElapsedMs(finalElapsed);
    
    try {
      if (sessionId) {
        await endSession(sessionId, new Date().toISOString(), finalElapsed);
      }
    } catch (error) {
      console.error("Error ending session:", error);
    } finally {
      setTimerStatus("idle");
      setSessionId(null);
      setElapsedMs(0);
      elapsedOffsetRef.current = 0;
      startTimeRef.current = null;
      if (selectedTask) {
        await loadSessions(selectedTask.id);
      }
    }
  };

  const toLocalIso = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const openAddModal = () => {
    setModalMode("add");
    setModalSessionId(null);
    setModalDatetime(toLocalIso(new Date()));
    setModalDuration("");
    setIsModalOpen(true);
  };

  const openEditModal = (session) => {
    setModalMode("edit");
    setModalSessionId(session.id);
    setModalDatetime(toLocalIso(session.started_at));
    setModalDuration(session.duration_ms ? Math.round(session.duration_ms / 60000).toString() : "0");
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalDatetime || !modalDuration) return;
    setIsModalSubmitting(true);
    
    try {
      const startedAt = new Date(modalDatetime).toISOString();
      const durationMs = parseInt(modalDuration) * 60000;
      const endedAt = new Date(new Date(startedAt).getTime() + durationMs).toISOString();

      if (modalMode === "add") {
        await addManualSession(selectedTask.id, startedAt, endedAt, durationMs);
      } else if (modalMode === "edit" && modalSessionId) {
        await updateSession(modalSessionId, startedAt, endedAt, durationMs);
      }
      setIsModalOpen(false);
      await loadSessions(selectedTask.id);
    } catch (error) {
      console.error("Error submitting manual session:", error);
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleRemoveSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this logged session?")) return;
    try {
      await deleteSession(sessionId);
      await loadSessions(selectedTask.id);
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  return (
    <div className={`layout-container ${selectedTask ? "has-selected-task" : ""}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>∞</span> Time Tracker
        </div>
        
        <div className="task-list">
          {isLoadingTasks && <div className="loading">Loading tasks...</div>}
          
          {!isLoadingTasks && tasks.length === 0 && (
            <div style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "2rem" }}>
              No tasks yet. Create one!
            </div>
          )}

          {!isLoadingTasks && tasks.map((task) => (
            <div 
              key={task.id} 
              className={`task-item ${selectedTask?.id === task.id ? "active" : ""}`}
              onClick={() => selectTask(task)}
            >
              <span className="task-emoji">{task.emoji || "🕒"}</span>
              <div className="task-info">
                <div className="task-name" title={task.name}>{task.name}</div>
                <div className="task-date">
                  {new Date(task.created_at).toLocaleDateString()}
                </div>
              </div>
              <button 
                className="delete-task-btn" 
                onClick={(e) => handleDeleteTask(e, task.id)}
                title="Delete Task"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <form className="add-task-form" onSubmit={handleAddTask}>
          <div className="emoji-picker-container">
            {showEmojiPicker && (
              <div className="emoji-grid">
                {AVAILABLE_EMOJIS.map(emoji => (
                  <button 
                    type="button" 
                    key={emoji} 
                    className="emoji-option"
                    onClick={() => {
                      setNewTaskEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <div className="input-group">
              <button 
                type="button" 
                className="emoji-toggle-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Pick Emoji"
              >
                {newTaskEmoji}
              </button>
              <input 
                type="text" 
                placeholder="New Task Name" 
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn primary" disabled={isAdding || !newTaskName.trim()}>
            {isAdding ? "Adding..." : "Add Task"}
          </button>
        </form>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!selectedTask ? (
          <div className="global-dashboard" style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Global Overview</h2>
              <div className="select-container">
                <select className="premium-select" value={lookbackDays} onChange={e => setLookbackDays(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  {lookbackOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            
            <div className="stats-section" style={{ marginTop: '0', marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-label">Today</div>
                <div className="stat-value">{formatDurationMs(stats.today)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Week</div>
                <div className="stat-value">{formatDurationMs(stats.week)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Month</div>
                <div className="stat-value">{formatDurationMs(stats.month)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Year</div>
                <div className="stat-value">{formatDurationMs(stats.year)}</div>
              </div>
            </div>

            <div className="chart-container" style={{ width: '100%', height: 400, background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Cumulative Time Tracked</h3>
              {isLoadingSessions ? <div className="loading">Loading chart data...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(val) => `${val}h`} tick={{fill: 'var(--text-secondary)'}} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    formatter={formatTooltip}
                    contentStyle={{ backgroundColor: 'rgba(15, 15, 20, 0.95)', borderRadius: '8px', border: '1px solid var(--border-glass)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {uniqueTasksForChart.map(task => (
                    <Bar key={task} dataKey={task} stackId="a" fill={chartColors[task]} radius={[0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : (
          <div className="timer-panel">
            <div className="timer-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <button className="mobile-back-btn" onClick={() => setSelectedTask(null)}>
                 ← Back to Tasks
               </button>
               <div className="select-container" style={{ marginLeft: 'auto', marginBottom: '1.5rem' }}>
                 <select className="premium-select" value={lookbackDays} onChange={e => setLookbackDays(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                    {lookbackOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                 </select>
               </div>
            </div>

            <div className="timer-task-info">
              <span className="timer-emoji">{selectedTask.emoji || "🕒"}</span>
              <div className="timer-name">{selectedTask.name}</div>
            </div>
            
            <div className={`timer-display ${timerStatus === "running" ? "timer-pulsing" : ""}`}>
              {formatTime(elapsedMs)}
            </div>

            <div className="timer-controls">
              {timerStatus === "idle" && (
                <button className="btn primary" onClick={handleStart}>
                  Start
                </button>
              )}
              {timerStatus === "running" && (
                <button className="btn warning" onClick={handlePause}>
                  Pause
                </button>
              )}
              {timerStatus === "paused" && (
                <button className="btn primary" onClick={handleStart}>
                  Resume
                </button>
              )}
              {timerStatus !== "idle" && (
                <button className="btn danger" onClick={handleStop}>
                  Stop
                </button>
              )}
              {timerStatus === "idle" && (
                <button className="btn" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid var(--border-glass)" }} onClick={openAddModal}>
                  + Add Manual Time
                </button>
              )}
            </div>

            {/* Stats and History */}
            <div className="stats-section">
              <div className="stat-card">
                <div className="stat-label">Today</div>
                <div className="stat-value">{formatDurationMs(stats.today)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Week</div>
                <div className="stat-value">{formatDurationMs(stats.week)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Month</div>
                <div className="stat-value">{formatDurationMs(stats.month)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Year</div>
                <div className="stat-value">{formatDurationMs(stats.year)}</div>
              </div>
            </div>

            <div className="chart-container" style={{ width: '100%', height: 300, marginTop: '2.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Time Tracked Over Time</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} dy={5} minTickGap={20} />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(val) => `${val}h`} tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} dx={-5} />
                  <Tooltip 
                    formatter={formatTooltip}
                    contentStyle={{ backgroundColor: 'rgba(15, 15, 20, 0.95)', borderRadius: '8px', border: '1px solid var(--border-glass)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--accent)' }}
                  />
                  <Bar dataKey="Hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="history-section">
              <h3>History</h3>
              {isLoadingSessions ? (
                <p className="loading">Loading sessions...</p>
              ) : sessions.length === 0 ? (
                <p className="no-history">No sessions recorded yet.</p>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 20).map((s) => {
                      const start = new Date(s.started_at);
                      const end = s.ended_at ? new Date(s.ended_at) : null;
                      return (
                        <tr key={s.id}>
                          <td>{start.toLocaleDateString()}</td>
                          <td>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>{formatDurationMs(s.duration_ms)}</td>
                          <td>
                            <div className="action-btns">
                              <button className="icon-btn" onClick={() => openEditModal(s)} title="Edit">✎</button>
                              <button className="icon-btn delete-icon" onClick={() => handleRemoveSession(s.id)} title="Delete">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Manual Time Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === "add" ? "Add Manual Time" : "Edit Tracked Time"}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleModalSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group">
                <label>Start Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={modalDatetime} 
                  onChange={(e) => setModalDatetime(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Duration (Minutes)</label>
                <input 
                  type="number" 
                  min="1" 
                  value={modalDuration} 
                  onChange={(e) => setModalDuration(e.target.value)} 
                  placeholder="e.g. 60"
                  required 
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn" style={{ background: "rgba(255,255,255,0.05)" }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={isModalSubmitting}>
                  {isModalSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
