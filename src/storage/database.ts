import { Stage, Task, HistoryEntry, Project } from '../types/models';

const DB_NAME = 'KanbanBoardDB';
const DB_VERSION = 2;

const STORES = {
  STAGES: 'stages',
  TASKS: 'tasks',
  HISTORY: 'history',
  PROJECTS: 'projects',
};

class Database {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Хранилище этапов
        if (!db.objectStoreNames.contains(STORES.STAGES)) {
          const stageStore = db.createObjectStore(STORES.STAGES, { keyPath: 'id' });
          stageStore.createIndex('order', 'order', { unique: false });
        }

        // Хранилище задач
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
          taskStore.createIndex('stageId', 'stageId', { unique: false });
        }

        // Хранилище истории
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const historyStore = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
          historyStore.createIndex('taskId', 'taskId', { unique: false });
        }

        // Хранилище проектов
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // ========== Этапы ==========
  async getAllStages(): Promise<Stage[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.STAGES);
      const request = store.getAll();
      request.onsuccess = () => {
        const stages = request.result as Stage[];
        resolve(stages.sort((a, b) => a.order - b.order));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveStage(stage: Stage): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.STAGES, 'readwrite');
      const request = store.put(stage);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteStage(stageId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.STAGES, 'readwrite');
      const request = store.delete(stageId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ========== Задачи ==========
  async getAllTasks(): Promise<Task[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as Task[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getTaskById(taskId: string): Promise<Task | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS);
      const request = store.get(taskId);
      request.onsuccess = () => resolve(request.result as Task | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async getTasksByStage(stageId: string): Promise<Task[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS);
      const index = store.index('stageId');
      const request = index.getAll(stageId);
      request.onsuccess = () => resolve(request.result as Task[]);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task: Task): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS, 'readwrite');
      const request = store.put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS, 'readwrite');
      const request = store.delete(taskId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ========== История ==========
  async addHistoryEntry(entry: HistoryEntry): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.HISTORY, 'readwrite');
      const request = store.add(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getHistoryByTask(taskId: string): Promise<HistoryEntry[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.HISTORY);
      const index = store.index('taskId');
      const request = index.getAll(taskId);
      request.onsuccess = () => {
        const entries = request.result as HistoryEntry[];
        resolve(entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearHistory(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.HISTORY, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ========== Проекты ==========
  async getAllProjects(): Promise<Project[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PROJECTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = request.result as Project[];
        resolve(projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getProjectById(projectId: string): Promise<Project | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PROJECTS);
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result as Project | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProject(project: Project): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PROJECTS, 'readwrite');
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PROJECTS, 'readwrite');
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new Database();
