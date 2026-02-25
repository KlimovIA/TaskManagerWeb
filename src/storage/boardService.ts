import { db } from './database';
import { Stage, Task, Note, HistoryEntry, HistoryOperationType, Project, TaskItem, CardType } from '../types/models';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export class BoardService {
  // ========== Этапы ==========
  async getStages(): Promise<Stage[]> {
    return db.getAllStages();
  }

  async createStage(name: string, color: string): Promise<Stage> {
    const stages = await db.getAllStages();
    const maxOrder = stages.reduce((max, s) => Math.max(max, s.order), -1);
    
    const stage: Stage = {
      id: generateId(),
      name,
      color,
      order: maxOrder + 1,
    };
    
    await db.saveStage(stage);
    return stage;
  }

  async updateStage(stageId: string, name: string, color: string): Promise<void> {
    const stage = await this.getStageById(stageId);
    if (!stage) throw new Error('Этап не найден');
    
    stage.name = name;
    stage.color = color;
    await db.saveStage(stage);
  }

  async deleteStage(stageId: string): Promise<void> {
    // Удаляем все задачи этого этапа
    const tasks = await db.getTasksByStage(stageId);
    for (const task of tasks) {
      await this.addHistoryEntry(task.id, 'task_deleted', `Задача "${task.title}" удалена вместе с этапом`);
      await db.deleteTask(task.id);
    }
    await db.deleteStage(stageId);
  }

  async getStageById(stageId: string): Promise<Stage | undefined> {
    const stages = await db.getAllStages();
    return stages.find(s => s.id === stageId);
  }

  // ========== Задачи ==========
  async getTasks(): Promise<Task[]> {
    return db.getAllTasks();
  }

  async createTask(stageId: string, title: string, cardTypes: CardType[] = []): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: generateId(),
      title,
      description: '',
      stageId,
      cardTypes,
      notes: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.saveTask(task);
    await this.addHistoryEntry(task.id, 'task_created', `Задача "${title}" создана`);

    return task;
  }

  async updateTask(taskId: string, updates: Partial<Pick<Task, 'title' | 'description' | 'stageId' | 'cardTypes'>>): Promise<Task> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error('Задача не найдена');

    const oldTitle = task.title;

    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.stageId !== undefined && updates.stageId !== task.stageId) {
      const newStage = await this.getStageById(updates.stageId);
      task.stageId = updates.stageId;
      await this.addHistoryEntry(
        task.id, 
        'task_moved', 
        `Задача "${oldTitle}" перенесена в "${newStage?.name || 'неизвестный этап'}"`
      );
    }
    
    if (updates.title !== undefined && updates.title !== oldTitle) {
      await this.addHistoryEntry(task.id, 'task_updated', `Название изменено с "${oldTitle}" на "${updates.title}"`);
    }
    
    task.updatedAt = new Date().toISOString();
    await db.saveTask(task);
    
    return task;
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = await db.getTaskById(taskId);
    if (task) {
      await this.addHistoryEntry(taskId, 'task_deleted', `Задача "${task.title}" удалена`);
      await db.deleteTask(taskId);
    }
  }

  async getTaskById(taskId: string): Promise<Task | undefined> {
    return db.getTaskById(taskId);
  }

  // ========== Заметки ==========
  async addNote(taskId: string, title: string, content: string): Promise<Note> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error('Задача не найдена');

    const noteNumber = task.notes.length + 1;
    const note: Note = {
      id: generateId(),
      title: title || 'Без названия',
      content,
      createdAt: new Date().toISOString(),
    };

    task.notes.push(note);
    task.updatedAt = new Date().toISOString();
    await db.saveTask(task);

    await this.addHistoryEntry(taskId, 'note_added', `Добавлена заметка №${noteNumber}`);

    return note;
  }

  async updateNote(taskId: string, noteId: string, content: string, title: string): Promise<void> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error('Задача не найдена');

    const note = task.notes.find(n => n.id === noteId);
    if (!note) throw new Error('Заметка не найдена');

    const noteNumber = task.notes.indexOf(note) + 1;
    note.title = title || 'Без названия';
    note.content = content;
    task.updatedAt = new Date().toISOString();
    await db.saveTask(task);

    await this.addHistoryEntry(taskId, 'note_updated', `Изменена заметка №${noteNumber}`);
  }

  async deleteNote(taskId: string, noteId: string): Promise<void> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error('Задача не найдена');

    const note = task.notes.find(n => n.id === noteId);
    if (!note) throw new Error('Заметка не найдена');

    const noteNumber = task.notes.indexOf(note) + 1;
    task.notes = task.notes.filter(n => n.id !== noteId);
    task.updatedAt = new Date().toISOString();
    await db.saveTask(task);

    await this.addHistoryEntry(taskId, 'note_deleted', `Удалена заметка №${noteNumber}`);
  }

  // ========== История ==========
  private async addHistoryEntry(taskId: string, operationType: HistoryOperationType, description: string): Promise<void> {
    const entry: HistoryEntry = {
      id: generateId(),
      taskId,
      operationType,
      description,
      timestamp: new Date().toISOString(),
    };
    await db.addHistoryEntry(entry);
  }

  async getTaskHistory(taskId: string): Promise<HistoryEntry[]> {
    return db.getHistoryByTask(taskId);
  }

  async clearTaskHistory(taskId: string): Promise<void> {
    await db.init();
    return new Promise((resolve, reject) => {
      const tx = db['db']!.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      const index = store.index('taskId');
      
      // Получаем все ключи для этого taskId
      const getKeyRequest = index.getAllKeys(taskId);
      
      getKeyRequest.onsuccess = () => {
        const keys = getKeyRequest.result as string[];
        if (keys.length === 0) {
          resolve();
          return;
        }
        
        // Удаляем все записи по ключам
        let deleted = 0;
        for (const key of keys) {
          const deleteRequest = store.delete(key);
          deleteRequest.onsuccess = () => {
            deleted++;
            if (deleted >= keys.length) {
              resolve();
            }
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        }
      };
      
      getKeyRequest.onerror = () => reject(getKeyRequest.error);
    });
  }

  // ========== Утилиты ==========
  formatDateTime(dateString: string): string {
    return formatDateTime(new Date(dateString));
  }

  // ========== Проекты ==========
  async getProjects(): Promise<Project[]> {
    return db.getAllProjects();
  }

  async createProject(name: string, description: string = ''): Promise<Project> {
    const now = new Date();
    const project: Project = {
      id: generateId(),
      name,
      description,
      taskItems: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.saveProject(project);
    return project;
  }

  async updateProject(projectId: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
    const project = await db.getProjectById(projectId);
    if (!project) throw new Error('Проект не найден');

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    project.updatedAt = new Date().toISOString();

    await db.saveProject(project);
    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    await db.deleteProject(projectId);
  }

  async getProjectById(projectId: string): Promise<Project | undefined> {
    return db.getProjectById(projectId);
  }

  // ========== Задачи проекта ==========
  async createTaskItem(projectId: string, title: string, description: string = ''): Promise<TaskItem> {
    const project = await db.getProjectById(projectId);
    if (!project) throw new Error('Проект не найден');

    const now = new Date();
    const taskItem: TaskItem = {
      id: generateId(),
      title,
      description,
      status: 'active',
      boardState: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    project.taskItems.push(taskItem);
    project.updatedAt = now.toISOString();
    await db.saveProject(project);

    return taskItem;
  }

  async updateTaskItem(projectId: string, taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'description' | 'status' | 'boardState'>>): Promise<TaskItem> {
    const project = await db.getProjectById(projectId);
    if (!project) throw new Error('Проект не найден');

    const taskItem = project.taskItems.find(t => t.id === taskId);
    if (!taskItem) throw new Error('Задача не найдена');

    if (updates.title !== undefined) taskItem.title = updates.title;
    if (updates.description !== undefined) taskItem.description = updates.description;
    if (updates.status !== undefined) taskItem.status = updates.status;
    if (updates.boardState !== undefined) taskItem.boardState = updates.boardState;

    taskItem.updatedAt = new Date().toISOString();
    project.updatedAt = taskItem.updatedAt;
    await db.saveProject(project);

    return taskItem;
  }

  async deleteTaskItem(projectId: string, taskId: string): Promise<void> {
    const project = await db.getProjectById(projectId);
    if (!project) throw new Error('Проект не найден');

    project.taskItems = project.taskItems.filter(t => t.id !== taskId);
    project.updatedAt = new Date().toISOString();
    await db.saveProject(project);
  }

  async getTaskItemById(projectId: string, taskId: string): Promise<TaskItem | undefined> {
    const project = await db.getProjectById(projectId);
    if (!project) return undefined;
    return project.taskItems.find(t => t.id === taskId);
  }

  async getActiveTasksCount(projectId: string): Promise<number> {
    const project = await db.getProjectById(projectId);
    if (!project) return 0;
    return project.taskItems.filter(t => t.status === 'active').length;
  }
}

export const boardService = new BoardService();
