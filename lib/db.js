import { supabase } from './supabase';

export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });
    
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

export async function createTask(name, emoji) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ name, emoji }])
    .select()
    .single();
    
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
    
  if (error) throw new Error(error.message || JSON.stringify(error));
}

export async function createSession(taskId, startedAt) {
  const { data, error } = await supabase
    .from('sessions')
    .insert([{ task_id: taskId, started_at: startedAt }])
    .select()
    .single();
    
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data.id;
}

export async function endSession(sessionId, endedAt, durationMs) {
  const { error } = await supabase
    .from('sessions')
    .update({ ended_at: endedAt, duration_ms: durationMs })
    .eq('id', sessionId);
    
  if (error) throw new Error(error.message || JSON.stringify(error));
}

export async function getSessionsForTask(taskId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('task_id', taskId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false });
    
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

export async function addManualSession(taskId, startedAt, endedAt, durationMs) {
  const { data, error } = await supabase
    .from('sessions')
    .insert([{ task_id: taskId, started_at: startedAt, ended_at: endedAt, duration_ms: durationMs }])
    .select()
    .single();
    
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

export async function updateSession(sessionId, startedAt, endedAt, durationMs) {
  const { error } = await supabase
    .from('sessions')
    .update({ started_at: startedAt, ended_at: endedAt, duration_ms: durationMs })
    .eq('id', sessionId);
    
  if (error) throw new Error(error.message || JSON.stringify(error));
}

export async function deleteSession(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
    
  if (error) throw new Error(error.message || JSON.stringify(error));
}
