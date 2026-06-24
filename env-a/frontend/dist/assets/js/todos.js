// Get all todos
async function getTodos() {
    try {
        const { response, data } = await apiFetch('/todos');
        if (response.ok) {
            return { success: true, todos: data.todos || [] };
        } else {
            return { success: false, message: data.error || 'Failed to fetch todos' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Add todo
async function addTodo(title, description = '') {
    try {
        const { response, data } = await apiFetch('/todos', {
            method: 'POST',
            body: JSON.stringify({ title, description })
        });

        if (response.ok) {
            return { success: true, todo: data };
        } else {
            return { success: false, message: data.error || 'Failed to add todo' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Update todo (toggle complete)
async function updateTodo(id, updates) {
    try {
        const { response, data } = await apiFetch(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        if (response.ok) {
            return { success: true, todo: data };
        } else {
            return { success: false, message: data.error || 'Failed to update todo' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Delete todo
async function deleteTodo(id) {
    try {
        const { response, data } = await apiFetch(`/todos/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            return { success: true };
        } else {
            return { success: false, message: data.error || 'Failed to delete todo' };
        }
    } catch (error) {
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Load and render todos
async function loadTodos() {
    const list = document.getElementById('todo-list');
    const result = await getTodos();

    if (!result.success) {
        list.innerHTML = `<li class="empty-state">❌ ${result.message}</li>`;
        return;
    }

    if (result.todos.length === 0) {
        list.innerHTML = `<li class="empty-state">🎉 No todos yet! Add one above.</li>`;
        return;
    }

    list.innerHTML = result.todos.map(todo => {
        const isCompleted = todo.completed;
        return `
            <li class="todo-item" data-id="${todo.id}">
                <span class="title ${isCompleted ? 'completed' : ''}">${todo.title}</span>
                <div class="actions">
                    <button class="btn-small ${isCompleted ? 'btn-complete' : 'btn-complete'}" onclick="toggleTodo(${todo.id}, ${!isCompleted})">
                        ${isCompleted ? '↩️ Undo' : '✅ Done'}
                    </button>
                    <button class="btn-small btn-delete" onclick="removeTodo(${todo.id})">🗑️ Delete</button>
                </div>
            </li>
        `;
    }).join('');
}

// Toggle todo completion
async function toggleTodo(id, completed) {
    const result = await updateTodo(id, { completed });
    if (result.success) {
        loadTodos();
    } else {
        showMessage(result.message, 'error');
    }
}

// Remove todo
async function removeTodo(id) {
    if (!confirm('Are you sure you want to delete this todo?')) return;
    const result = await deleteTodo(id);
    if (result.success) {
        loadTodos();
        showMessage('Todo deleted!', 'success');
    } else {
        showMessage(result.message, 'error');
    }
}