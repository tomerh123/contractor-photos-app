import React, { useState, useEffect } from 'react';
import * as db from '../db';
import { Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const PunchListView = ({ projectId }) => {
    const [todos, setTodos] = useState([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTodos();
    }, [projectId]);

    const loadTodos = async () => {
        setLoading(true);
        const fetchedTodos = await db.getTodosForProject(projectId);
        setTodos(fetchedTodos);
        setLoading(false);
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;

        await db.addTodo({
            ProjectID: projectId,
            Text: newTaskText.trim()
        });

        setNewTaskText('');
        loadTodos();
    };

    const handleToggleTodo = async (todoId) => {
        // Optimistic UI update
        const updatedTodos = todos.map(t =>
            t.TodoID === todoId ? { ...t, IsCompleted: !t.IsCompleted } : t
        );
        setTodos(updatedTodos);

        // Persist to DB
        await db.toggleTodo(todoId);
        loadTodos(); // Refresh to catch actual DB state and sorting
    };

    const handleDeleteTodo = async (todoId) => {
        await db.deleteTodo(todoId);
        loadTodos();
    };

    // Sort todos: active ones first, completed ones at the bottom, then by timestamp
    const sortedTodos = [...todos].sort((a, b) => {
        if (a.IsCompleted === b.IsCompleted) {
            return new Date(a.Timestamp) - new Date(b.Timestamp);
        }
        return a.IsCompleted ? 1 : -1;
    });

    if (loading) {
        return <LoadingSpinner fullScreen={false} message="Loading punch list..." padding="2rem" />;
    }

    return (
        <div style={{ backgroundColor: 'var(--background)', minHeight: '100%', paddingBottom: '2rem' }}>

            {/* Add Task Input Form */}
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Add a new task..."
                    style={{
                        flex: 1,
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                />
                <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    style={{
                        backgroundColor: newTaskText.trim() ? 'var(--primary-color)' : 'var(--surface-active)',
                        color: newTaskText.trim() ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: newTaskText.trim() ? 'pointer' : 'not-allowed',
                        transition: 'background-color 0.2s, color 0.2s'
                    }}
                >
                    <span style={{ fontWeight: 'bold' }}>Add</span>
                </button>
            </form>

            {/* Todo List */}
            {todos.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '16px', color: 'var(--text-secondary)', border: '1px dashed var(--border)' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--text-primary)' }}>No tasks left behind!</p>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Create a punch list to track remaining work items for this location.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sortedTodos.map((todo) => (
                        <div
                            key={todo.TodoID}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: 'var(--surface)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                transition: 'opacity 0.2s',
                                opacity: todo.IsCompleted ? 0.6 : 1
                            }}
                        >
                            <button
                                onClick={() => handleToggleTodo(todo.TodoID)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: todo.IsCompleted ? '#10b981' : 'var(--text-secondary)', // Emerald green for checked
                                    flexShrink: 0
                                }}
                            >
                                {todo.IsCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                            </button>

                            <span style={{
                                flex: 1,
                                fontSize: '1rem',
                                color: todo.IsCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                                textDecoration: todo.IsCompleted ? 'line-through' : 'none',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word'
                            }}>
                                {todo.Text}
                            </span>

                            <button
                                onClick={() => handleDeleteTodo(todo.TodoID)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '8px',
                                    margin: '-8px -8px -8px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--danger)',
                                    opacity: 0.6,
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PunchListView;
