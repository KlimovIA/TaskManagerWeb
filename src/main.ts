import './styles/main.css';
import { Stage, Task, Project, TaskItem, Note, HistoryEntry, HistoryOperationType, BoardState, CardType } from './types/models';
import { boardService } from './storage/boardService';
import { StageRenderer } from './ui/stageRenderer';
import { TaskPanel } from './ui/taskPanel';
import { HistoryPanel } from './ui/historyPanel';
import { ProjectList } from './ui/projectList';
import { TaskList } from './ui/taskList';

class KanbanApp {
  // Элементы представлений
  private projectsView: HTMLElement;
  private taskListView: HTMLElement;
  private boardView: HTMLElement;
  private appTitle: HTMLElement;
  private addProjectBtn: HTMLElement;

  // Контейнеры
  private projectsListContainer: HTMLElement;
  private taskListContainer: HTMLElement;
  private board: HTMLElement;
  private boardTaskTitle: HTMLElement;

  // Компоненты
  private projectList: ProjectList;
  private taskList: TaskList;
  private stageRenderer: StageRenderer;
  private taskPanel: TaskPanel;
  private historyPanel: HistoryPanel;

  // Состояние
  private currentProjectId: string | null = null;
  private currentTaskItemId: string | null = null;
  private currentTaskId: string | null = null;
  private isMovingTask: boolean = false;

  // Модальные окна
  private stageModal: HTMLElement;
  private projectModal: HTMLElement;
  private taskItemModal: HTMLElement;
  private cardModal: HTMLElement;
  private editingStageId: string | null = null;
  private editingProjectId: string | null = null;
  private editingTaskItemId: string | null = null;

  // Выбранные типы карточек
  private selectedCardTypes: CardType[] = [];
  private currentStageIdForCard: string | null = null;

  // Данные
  private stages: Stage[] = [];
  private tasks: Task[] = [];

  constructor() {
    // Элементы представлений
    this.projectsView = document.getElementById('projects-view')!;
    this.taskListView = document.getElementById('task-list-view')!;
    this.boardView = document.getElementById('board-view')!;
    this.appTitle = document.getElementById('app-title')!;
    this.addProjectBtn = document.getElementById('add-project-btn')!;

    // Контейнеры
    this.projectsListContainer = document.getElementById('projects-list')!;
    this.taskListContainer = document.getElementById('task-list-container')!;
    this.board = document.getElementById('board')!;
    this.boardTaskTitle = document.getElementById('board-task-title')!;

    // Модальные окна
    this.stageModal = document.getElementById('stage-modal')!;
    this.projectModal = document.getElementById('project-modal')!;
    this.taskItemModal = document.getElementById('task-item-modal')!;
    this.cardModal = document.getElementById('card-modal')!;

    // Инициализация компонентов
    this.projectList = new ProjectList(
      this.projectsListContainer,
      (projectId) => this.openProject(projectId),
      (project) => this.openProjectModal(project),
      (project) => this.deleteProject(project),
      () => this.openProjectModal()
    );

    this.taskList = new TaskList(
      this.taskListContainer,
      (taskId) => this.openTaskItem(taskId),
      (task) => this.openTaskItemModal(task),
      (task) => this.deleteTaskItem(task),
      () => this.openTaskItemModal(),
      () => this.showProjects()
    );

    this.stageRenderer = new StageRenderer(
      (taskId) => this.openTask(taskId),
      (taskId) => this.deleteTask(taskId),
      (stage) => this.editStage(stage),
      (stage) => this.deleteStage(stage),
      (stageId) => this.addTask(stageId)
    );

    this.taskPanel = new TaskPanel(
      (taskId, updates) => this.updateTask(taskId, updates),
      (taskId) => this.deleteTask(taskId),
      (taskId, title, content) => this.addNote(taskId, title, content),
      (taskId, noteId, content, title) => this.updateNote(taskId, noteId, content, title),
      (taskId, noteId) => this.deleteNote(taskId, noteId),
      (taskId) => this.showHistory(taskId),
      () => this.closeTaskPanel()
    );

    this.historyPanel = new HistoryPanel((taskId) => this.clearHistory(taskId));

    this.setupEventListeners();
    this.showProjects();
  }

  private setupEventListeners(): void {
    // Сохранение проекта
    document.getElementById('save-project-btn')!.addEventListener('click', () => {
      this.saveProject();
    });

    // Отмена создания проекта
    document.getElementById('cancel-project-btn')!.addEventListener('click', () => {
      this.closeProjectModal();
    });

    // Закрытие модального окна проекта по клику вне
    this.projectModal.addEventListener('click', (e) => {
      if (e.target === this.projectModal) {
        this.closeProjectModal();
      }
    });

    // Сохранение задачи проекта
    document.getElementById('save-task-item-btn')!.addEventListener('click', () => {
      this.saveTaskItem();
    });

    // Отмена создания задачи
    document.getElementById('cancel-task-item-btn')!.addEventListener('click', () => {
      this.closeTaskItemModal();
    });

    // Закрытие модального окна задачи по клику вне
    this.taskItemModal.addEventListener('click', (e) => {
      if (e.target === this.taskItemModal) {
        this.closeTaskItemModal();
      }
    });

    // Обработчики для модального окна создания карточки
    document.getElementById('save-card-btn')!.addEventListener('click', () => {
      this.saveCard();
    });

    document.getElementById('cancel-card-btn')!.addEventListener('click', () => {
      this.closeCardModal();
    });

    this.cardModal.addEventListener('click', (e) => {
      if (e.target === this.cardModal) {
        this.closeCardModal();
      }
    });

    // Обработчики для плиток типов карточек
    document.querySelectorAll('.card-type-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const type = tile.getAttribute('data-type') as CardType;
        this.toggleCardType(type);
      });
    });

    // Возврат к задачам из доски
    document.getElementById('back-to-tasks-btn')!.addEventListener('click', () => {
      if (this.currentProjectId) {
        this.showTaskList(this.currentProjectId);
      }
    });

    // Обработчики для этапов (существующие)
    document.getElementById('add-stage-btn')!.addEventListener('click', () => {
      this.openStageModal();
    });

    document.getElementById('save-stage-btn')!.addEventListener('click', () => {
      this.saveStage();
    });

    document.getElementById('cancel-stage-btn')!.addEventListener('click', () => {
      this.closeStageModal();
    });

    this.stageModal.addEventListener('click', (e) => {
      if (e.target === this.stageModal) {
        this.closeStageModal();
      }
    });
  }

  // ========== Навигация ==========
  private showView(view: 'projects' | 'taskList' | 'board'): void {
    this.projectsView.classList.toggle('hidden', view !== 'projects');
    this.taskListView.classList.toggle('hidden', view !== 'taskList');
    this.boardView.classList.toggle('hidden', view !== 'board');

    // Обновление заголовка и кнопки
    if (view === 'projects') {
      this.appTitle.textContent = 'Проекты';
      this.addProjectBtn.textContent = '+ Добавить проект';
      this.addProjectBtn.classList.remove('hidden');
    } else if (view === 'taskList') {
      this.appTitle.textContent = 'Задачи';
      this.addProjectBtn.classList.add('hidden');
    } else {
      this.appTitle.textContent = 'Подзадачи';
      this.addProjectBtn.classList.add('hidden');
    }

    // Обновляем обработчик кнопки
    this.addProjectBtn.onclick = () => {
      if (view === 'projects') {
        this.openProjectModal();
      } else if (view === 'taskList') {
        this.openTaskItemModal();
      }
    };
  }

  private async showProjects(): Promise<void> {
    this.currentProjectId = null;
    this.currentTaskItemId = null;
    this.currentTaskId = null;
    
    // Проверка: если нет проектов, создаём проект по умолчанию
    const projects = await boardService.getProjects();
    if (projects.length === 0) {
      await this.createDefaultProject();
    }
    
    this.showView('projects');
    await this.projectList.render();
  }

  private async createDefaultProject(): Promise<void> {
    try {
      // Создаём проект по умолчанию
      const project = await boardService.createProject('Проект1', 'Проект по умолчанию');
      
      // Создаём задачу по умолчанию
      await boardService.createTaskItem(project.id, 'Задача1', 'Задача по умолчанию');
      
      console.log('Создан проект по умолчанию с задачей');
    } catch (error) {
      console.error('Ошибка создания проекта по умолчанию:', error);
    }
  }

  private async showTaskList(projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    this.currentTaskItemId = null;
    this.currentTaskId = null;
    this.showView('taskList');
    await this.taskList.render(projectId);
  }

  private async showBoard(taskItemId: string): Promise<void> {
    if (!this.currentProjectId) return;

    this.currentTaskItemId = taskItemId;
    this.showView('board');

    // Загрузка состояния доски
    await this.loadBoard(taskItemId);
  }

  // ========== Проекты ==========
  private openProjectModal(project?: Project): void {
    this.editingProjectId = project?.id || null;
    const modalTitle = document.getElementById('project-modal-title')!;
    const nameInput = document.getElementById('project-name')! as HTMLInputElement;
    const descriptionInput = document.getElementById('project-description')! as HTMLTextAreaElement;

    if (project) {
      modalTitle.textContent = 'Редактировать проект';
      nameInput.value = project.name;
      descriptionInput.value = project.description;
    } else {
      modalTitle.textContent = 'Новый проект';
      nameInput.value = '';
      descriptionInput.value = '';
    }

    this.projectModal.classList.remove('hidden');
    nameInput.focus();
  }

  private closeProjectModal(): void {
    this.projectModal.classList.add('hidden');
    this.editingProjectId = null;
  }

  private async saveProject(): Promise<void> {
    const nameInput = document.getElementById('project-name')! as HTMLInputElement;
    const descriptionInput = document.getElementById('project-description')! as HTMLTextAreaElement;

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
      alert('Введите название проекта');
      return;
    }

    try {
      if (this.editingProjectId) {
        await boardService.updateProject(this.editingProjectId, { name, description });
      } else {
        await boardService.createProject(name, description);
      }

      this.closeProjectModal();
      await this.projectList.render();
    } catch (error) {
      console.error('Ошибка сохранения проекта:', error);
      alert('Ошибка при сохранении проекта');
    }
  }

  private async deleteProject(project: Project): Promise<void> {
    try {
      await boardService.deleteProject(project.id);
      await this.projectList.render();
    } catch (error) {
      console.error('Ошибка удаления проекта:', error);
      alert('Ошибка при удалении проекта');
    }
  }

  private async openProject(projectId: string): Promise<void> {
    await this.showTaskList(projectId);
  }

  // ========== Задачи проекта ==========
  private openTaskItemModal(taskItem?: TaskItem): void {
    this.editingTaskItemId = taskItem?.id || null;
    const modalTitle = document.getElementById('task-item-modal-title')!;
    const titleInput = document.getElementById('task-item-title')! as HTMLInputElement;
    const descriptionInput = document.getElementById('task-item-description')! as HTMLTextAreaElement;
    const statusSelect = document.getElementById('task-item-status')! as HTMLSelectElement;

    if (taskItem) {
      modalTitle.textContent = 'Редактировать задачу';
      titleInput.value = taskItem.title;
      descriptionInput.value = taskItem.description;
      statusSelect.value = taskItem.status;
    } else {
      modalTitle.textContent = 'Новая задача';
      titleInput.value = '';
      descriptionInput.value = '';
      statusSelect.value = 'active';
    }

    this.taskItemModal.classList.remove('hidden');
    titleInput.focus();
  }

  private closeTaskItemModal(): void {
    this.taskItemModal.classList.add('hidden');
    this.editingTaskItemId = null;
  }

  private async saveTaskItem(): Promise<void> {
    if (!this.currentProjectId) return;

    const titleInput = document.getElementById('task-item-title')! as HTMLInputElement;
    const descriptionInput = document.getElementById('task-item-description')! as HTMLTextAreaElement;
    const statusSelect = document.getElementById('task-item-status')! as HTMLSelectElement;

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const status = statusSelect.value as TaskItem['status'];

    if (!title) {
      alert('Введите название задачи');
      return;
    }

    try {
      if (this.editingTaskItemId) {
        await boardService.updateTaskItem(this.currentProjectId, this.editingTaskItemId, { title, description, status });
      } else {
        await boardService.createTaskItem(this.currentProjectId, title, description);
      }

      this.closeTaskItemModal();
      await this.taskList.render(this.currentProjectId);
    } catch (error) {
      console.error('Ошибка сохранения задачи:', error);
      alert('Ошибка при сохранении задачи');
    }
  }

  private async deleteTaskItem(taskItem: TaskItem): Promise<void> {
    if (!this.currentProjectId) return;

    try {
      await boardService.deleteTaskItem(this.currentProjectId, taskItem.id);
      await this.taskList.render(this.currentProjectId);
    } catch (error) {
      console.error('Ошибка удаления задачи:', error);
      alert('Ошибка при удалении задачи');
    }
  }

  private async openTaskItem(taskItemId: string): Promise<void> {
    await this.showBoard(taskItemId);
  }

  // ========== Канбан-доска ==========
  private async loadBoard(taskItemId: string): Promise<void> {
    if (!this.currentProjectId) return;

    const taskItem = await boardService.getTaskItemById(this.currentProjectId, taskItemId);
    if (!taskItem) {
      alert('Задача не найдена');
      this.showTaskList(this.currentProjectId);
      return;
    }

    this.boardTaskTitle.textContent = taskItem.title;

    // Если нет состояния доски, создаём по умолчанию
    if (!taskItem.boardState || !taskItem.boardState.stages || taskItem.boardState.stages.length === 0) {
      await this.createDefaultBoardState(taskItemId);
      // Перезагружаем задачу после создания boardState
      const updatedTaskItem = await boardService.getTaskItemById(this.currentProjectId, taskItemId);
      if (!updatedTaskItem || !updatedTaskItem.boardState) {
        alert('Ошибка создания доски');
        this.showTaskList(this.currentProjectId);
        return;
      }
      this.stages = updatedTaskItem.boardState.stages;
      this.tasks = updatedTaskItem.boardState.tasks;
    } else {
      const boardState = taskItem.boardState;
      this.stages = boardState.stages;
      this.tasks = boardState.tasks;
    }

    this.renderBoard();
    this.taskPanel.setStages(this.stages);
  }

  private async createDefaultBoardState(taskItemId: string): Promise<void> {
    if (!this.currentProjectId) return;

    const defaultStages = [
      { name: 'Нужно сделать', color: '#e09f7d' },
      { name: 'В работе', color: '#f4c77e' },
      { name: 'Тестирование', color: '#b8a5e0' },
      { name: 'Готово', color: '#9bc9a3' },
    ];

    const stages: Stage[] = [];
    for (let i = 0; i < defaultStages.length; i++) {
      const stage: Stage = {
        id: `stage-${i}-${Date.now()}`,
        name: defaultStages[i].name,
        color: defaultStages[i].color,
        order: i,
      };
      stages.push(stage);
    }

    const boardState: BoardState = {
      stages,
      tasks: [],
      history: [],
    };

    await boardService.updateTaskItem(this.currentProjectId, taskItemId, { boardState });
  }

  private renderBoard(): void {
    this.board.innerHTML = '';

    for (const stage of this.stages) {
      const stageEl = this.stageRenderer.renderStage(stage, this.tasks);
      this.board.appendChild(stageEl);
    }

    this.setupTaskDragDrop();
  }

  private async saveBoardState(): Promise<void> {
    if (!this.currentProjectId || !this.currentTaskItemId) return;

    const boardState: BoardState = {
      stages: this.stages,
      tasks: this.tasks,
      history: [], // История хранится отдельно
    };

    await boardService.updateTaskItem(this.currentProjectId, this.currentTaskItemId, { boardState });
  }

  // ========== Этапы ==========
  private openStageModal(stage?: Stage): void {
    this.editingStageId = stage?.id || null;
    const modalTitle = document.getElementById('stage-modal-title')!;
    const nameInput = document.getElementById('stage-name')! as HTMLInputElement;
    const colorInput = document.getElementById('stage-color')! as HTMLInputElement;

    if (stage) {
      modalTitle.textContent = 'Редактировать этап';
      nameInput.value = stage.name;
      colorInput.value = this.rgbToHex(stage.color);
    } else {
      modalTitle.textContent = 'Новый этап';
      nameInput.value = '';
      colorInput.value = '#4a90d9';
    }

    this.stageModal.classList.remove('hidden');
    nameInput.focus();
  }

  private closeStageModal(): void {
    this.stageModal.classList.add('hidden');
    this.editingStageId = null;
  }

  private async saveStage(): Promise<void> {
    const nameInput = document.getElementById('stage-name')! as HTMLInputElement;
    const colorInput = document.getElementById('stage-color')! as HTMLInputElement;

    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
      alert('Введите название этапа');
      return;
    }

    try {
      if (this.editingStageId) {
        const stage = this.stages.find(s => s.id === this.editingStageId);
        if (stage) {
          stage.name = name;
          stage.color = color;
          await this.saveBoardState();
        }
      } else {
        const newStage: Stage = {
          id: `stage-${Date.now()}`,
          name,
          color,
          order: this.stages.length,
        };
        this.stages.push(newStage);
        await this.saveBoardState();
      }

      this.closeStageModal();
      this.renderBoard();
    } catch (error) {
      console.error('Ошибка сохранения этапа:', error);
      alert('Ошибка при сохранении этапа');
    }
  }

  private async editStage(stage: Stage): Promise<void> {
    this.openStageModal(stage);
  }

  private async deleteStage(stage: Stage): Promise<void> {
    try {
      // Удаляем все задачи этого этапа
      const tasksToDelete = this.tasks.filter(t => t.stageId === stage.id);
      for (const task of tasksToDelete) {
        await this.deleteTask(task.id);
      }

      this.stages = this.stages.filter(s => s.id !== stage.id);
      // Обновляем order
      this.stages.forEach((s, i) => s.order = i);

      await this.saveBoardState();
      this.renderBoard();
    } catch (error) {
      console.error('Ошибка удаления этапа:', error);
      alert('Ошибка при удалении этапа');
    }
  }

  // ========== Задачи ==========
  private async addTask(stageId: string): Promise<void> {
    this.currentStageIdForCard = stageId;
    this.selectedCardTypes = [];
    this.updateCardTypesSelection();
    
    const titleInput = document.getElementById('card-title')! as HTMLInputElement;
    titleInput.value = '';
    
    document.getElementById('card-modal-title')!.textContent = 'Новая подзадача';
    this.cardModal.classList.remove('hidden');
    titleInput.focus();
  }

  private updateCardTypesSelection(): void {
    const tiles = document.querySelectorAll('.card-type-tile');
    tiles.forEach(tile => {
      const type = tile.getAttribute('data-type') as CardType;
      if (this.selectedCardTypes.includes(type)) {
        tile.classList.add('selected');
      } else {
        tile.classList.remove('selected');
      }
    });
  }

  private toggleCardType(type: CardType): void {
    const index = this.selectedCardTypes.indexOf(type);
    if (index > -1) {
      this.selectedCardTypes.splice(index, 1);
    } else {
      this.selectedCardTypes.push(type);
    }
    this.updateCardTypesSelection();
  }

  private closeCardModal(): void {
    this.cardModal.classList.add('hidden');
    this.currentStageIdForCard = null;
    this.selectedCardTypes = [];
  }

  private async saveCard(): Promise<void> {
    if (!this.currentStageIdForCard) return;

    const titleInput = document.getElementById('card-title')! as HTMLInputElement;
    const title = titleInput.value.trim();

    if (!title) {
      alert('Введите название карточки');
      return;
    }

    try {
      const task = await this.createTaskInBoard(this.currentStageIdForCard, title.trim(), this.selectedCardTypes);
      this.tasks.push(task);
      this.renderBoard();
      await this.saveBoardState();
      this.closeCardModal();
    } catch (error) {
      console.error('Ошибка создания карточки:', error);
      alert('Ошибка при создании карточки');
    }
  }

  private async createTaskInBoard(stageId: string, title: string, cardTypes: CardType[] = []): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: `task-${Date.now()}`,
      title,
      description: '',
      stageId,
      cardTypes,
      notes: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return task;
  }

  private openTask(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      this.currentTaskId = taskId;
      this.taskPanel.show(task);
      this.historyPanel.refreshImmediate(taskId);
    }
  }

  private closeTaskPanel(): void {
    this.taskPanel.hide();
    this.currentTaskId = null;
  }

  private async updateTask(taskId: string, updates: { title?: string; description?: string; stageId?: string }): Promise<void> {
    try {
      const taskIndex = this.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;

      const task = this.tasks[taskIndex];
      const oldTitle = task.title;

      if (updates.title !== undefined) task.title = updates.title;
      if (updates.description !== undefined) task.description = updates.description;
      if (updates.stageId !== undefined && updates.stageId !== task.stageId) {
        const newStage = this.stages.find(s => s.id === updates.stageId);
        task.stageId = updates.stageId;
        // Добавляем запись в историю
        this.addHistoryEntry(taskId, 'task_moved', `Задача "${oldTitle}" перенесена в "${newStage?.name || 'неизвестный этап'}"`);
      }

      task.updatedAt = new Date().toISOString();
      this.tasks[taskIndex] = task;

      this.renderBoard();
      await this.saveBoardState();

      if (this.currentTaskId === taskId) {
        this.taskPanel.refreshCurrentTask();
        this.historyPanel.refreshImmediate(taskId);
      }
    } catch (error) {
      console.error('Ошибка обновления задачи:', error);
    }
  }

  private async deleteTask(taskId: string): Promise<void> {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        this.addHistoryEntry(taskId, 'task_deleted', `Задача "${task.title}" удалена`);
      }

      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.renderBoard();
      this.closeTaskPanel();
      await this.saveBoardState();
    } catch (error) {
      console.error('Ошибка удаления задачи:', error);
      alert('Ошибка при удалении задачи');
    }
  }

  // ========== Заметки ==========
  private async addNote(taskId: string, title: string, content: string): Promise<void> {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const noteNumber = task.notes.length + 1;
      const note: Note = {
        id: `note-${Date.now()}`,
        title: title || 'Без названия',
        content,
        createdAt: new Date().toISOString(),
      };

      task.notes.push(note);
      task.updatedAt = new Date().toISOString();
      this.addHistoryEntry(taskId, 'note_added', `Добавлена заметка №${noteNumber}`);

      await this.saveBoardState();

      if (this.currentTaskId === taskId) {
        this.taskPanel.show(task);
        this.historyPanel.refreshImmediate(taskId);
      }
    } catch (error) {
      console.error('Ошибка добавления заметки:', error);
    }
  }

  private async updateNote(taskId: string, noteId: string, content: string, title: string): Promise<void> {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const note = task.notes.find(n => n.id === noteId);
      if (!note) return;

      const noteNumber = task.notes.indexOf(note) + 1;
      note.title = title || 'Без названия';
      note.content = content;
      task.updatedAt = new Date().toISOString();

      this.addHistoryEntry(taskId, 'note_updated', `Изменена заметка №${noteNumber}`);
      await this.saveBoardState();

      if (this.currentTaskId === taskId) {
        this.historyPanel.refreshImmediate(taskId);
      }
    } catch (error) {
      console.error('Ошибка обновления заметки:', error);
    }
  }

  private async deleteNote(taskId: string, noteId: string): Promise<void> {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const note = task.notes.find(n => n.id === noteId);
      if (!note) return;

      const noteNumber = task.notes.indexOf(note) + 1;
      task.notes = task.notes.filter(n => n.id !== noteId);
      task.updatedAt = new Date().toISOString();

      this.addHistoryEntry(taskId, 'note_deleted', `Удалена заметка №${noteNumber}`);
      await this.saveBoardState();

      if (this.currentTaskId === taskId) {
        this.historyPanel.refreshImmediate(taskId);
      }
    } catch (error) {
      console.error('Ошибка удаления заметки:', error);
    }
  }

  // ========== История ==========
  private addHistoryEntry(_taskId: string, operationType: HistoryOperationType, description: string): void {
    // Для простоты храним историю в памяти, пока задача открыта
    // В реальном приложении нужно сохранять в IndexedDB
    console.log(`History: ${operationType} - ${description}`);
  }

  private async showHistory(_taskId: string): Promise<void> {
    // История хранится в boardService для задач канбан-доски
    // Но теперь у нас задачи канбана внутри TaskItem, так что история локальная
    const history: HistoryEntry[] = [];
    this.historyPanel.show(history, _taskId);
  }

  private async clearHistory(_taskId: string): Promise<void> {
    // Очистка локальной истории
  }

  // ========== Drag and Drop для задач ==========
  private setupTaskDragDrop(): void {
    const taskCards = document.querySelectorAll('.task-card');

    taskCards.forEach(card => {
      card.addEventListener('dragstart', ((e: Event) => {
        const dragEvent = e as DragEvent;
        card.classList.add('dragging');
        const cardEl = card as HTMLElement;
        dragEvent.dataTransfer?.setData('text/plain', cardEl.dataset.taskId || '');
        dragEvent.dataTransfer!.effectAllowed = 'move';
      }) as EventListener);

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.stage').forEach(stage => {
          stage.classList.remove('drag-over');
        });
      });
    });

    this.board.addEventListener('dragover', ((e: Event) => {
      e.preventDefault();
    }) as EventListener);

    this.board.addEventListener('drop', async (e: Event) => {
      e.preventDefault();
      const dragEvent = e as DragEvent;
      const taskId = dragEvent.dataTransfer?.getData('text/plain');
      const stageEl = (e.target as HTMLElement).closest('.stage') as HTMLElement;

      if (taskId && stageEl) {
        const newStageId = stageEl.dataset.stageId;
        if (newStageId) {
          await this.moveTask(taskId, newStageId);
        }
      }
    });
  }

  private async moveTask(taskId: string, newStageId: string): Promise<void> {
    if (this.isMovingTask) return;

    this.isMovingTask = true;
    try {
      await this.updateTask(taskId, { stageId: newStageId });
    } catch (error) {
      console.error('Ошибка перемещения задачи:', error);
    } finally {
      this.isMovingTask = false;
    }
  }

  // ========== Утилиты ==========
  private rgbToHex(rgb: string): string {
    if (rgb.startsWith('#')) return rgb;

    const match = rgb.match(/\d+/g);
    if (!match) return '#4a90d9';

    const [r, g, b] = match.map(Number);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  new KanbanApp();
});
