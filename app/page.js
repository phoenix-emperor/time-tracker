"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getTasks, createTask, deleteTask, createSession, endSession, getSessionsForTask } from "@/lib/db";

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
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, year: 0 });
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

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

  const loadSessions = useCallback(async (taskId) => {
    if (!taskId) return;
    setIsLoadingSessions(true);
    try {
      const data = await getSessionsForTask(taskId);
      const validSessions = data || [];
      setSessions(validSessions);
      
      const now = new Date();
      let d_today = 0, d_week = 0, d_month = 0, d_year = 0;
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      validSessions.forEach(s => {
        if (!s.duration_ms) return;
        const sDate = new Date(s.started_at);
        const hours = s.duration_ms / (1000 * 60 * 60);
        
        if (sDate.toDateString() === now.toDateString()) d_today += hours;
        if (sDate >= startOfWeek) d_week += hours;
        if (sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear()) d_month += hours;
        if (sDate.getFullYear() === now.getFullYear()) d_year += hours;
      });
      
      setStats({
        today: Number(d_today.toFixed(2)),
        week: Number(d_week.toFixed(2)),
        month: Number(d_month.toFixed(2)),
        year: Number(d_year.toFixed(2))
      });
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTask) {
      loadSessions(selectedTask.id);
    } else {
      setSessions([]);
      setStats({ today: 0, week: 0, month: 0, year: 0 });
    }
  }, [selectedTask, loadSessions]);

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

  return (
    <div className="layout-container">
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
          <div className="empty-state">
            <h2>Track Your Time</h2>
            <p>Select a task from the sidebar or create a new one to begin.</p>
          </div>
        ) : (
          <div className="timer-panel">
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
            </div>

            {/* Stats and History */}
            <div className="stats-section">
              <div className="stat-card">
                <div className="stat-label">Today</div>
                <div className="stat-value">{stats.today}h</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Week</div>
                <div className="stat-value">{stats.week}h</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Month</div>
                <div className="stat-value">{stats.month}h</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Year</div>
                <div className="stat-value">{stats.year}h</div>
              </div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 20).map((s) => {
                      const start = new Date(s.started_at);
                      const end = s.ended_at ? new Date(s.ended_at) : null;
                      const hrs = s.duration_ms ? (s.duration_ms / 3600000).toFixed(2) : "0.00";
                      return (
                        <tr key={s.id}>
                          <td>{start.toLocaleDateString()}</td>
                          <td>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>{hrs} h</td>
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
    </div>
  );
}
