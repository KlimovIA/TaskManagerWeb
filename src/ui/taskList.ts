import { Project, TaskItem, TaskStatus } from '../types/models';
import { boardService } from '../storage/boardService';

export class TaskList {
  private container: HTMLElement;
  private currentProject: Project | null = null;
  private onTaskClick: (taskId: string) => void;
  private onTaskEdit: (task: TaskItem) => void;
  private onTaskDelete: (task: TaskItem) => void;
  private onAddTask: () => void;
  private onBack: () => void;

  constructor(
    container: HTMLElement,
    onTaskClick: (taskId: string) => void,
    onTaskEdit: (task: TaskItem) => void,
    onTaskDelete: (task: TaskItem) => void,
    onAddTask: () => void,
    onBack: () => void
  ) {
    this.container = container;
    this.onTaskClick = onTaskClick;
    this.onTaskEdit = onTaskEdit;
    this.onTaskDelete = onTaskDelete;
    this.onAddTask = onAddTask;
    this.onBack = onBack;
  }

  async render(projectId: string): Promise<void> {
    const project = await boardService.getProjectById(projectId);
    if (!project) {
      this.container.innerHTML = '<div class="empty-state">Проект не найден</div>';
      return;
    }

    this.currentProject = project;

    const activeTasks = project.taskItems.filter(t => t.status === 'active');
    const completedTasks = project.taskItems.filter(t => t.status === 'completed');
    const revisionTasks = project.taskItems.filter(t => t.status === 'revision');

    this.container.innerHTML = `
      <div class="task-list-header">
        <button class="btn btn-icon back-btn" id="back-to-projects-btn">←</button>
        <div class="task-list-title-block">
          <h1 class="task-list-title">${this.escapeHtml(project.name)}</h1>
          ${project.description ? `<p class="task-list-description">${this.escapeHtml(project.description)}</p>` : ''}
        </div>
        <button class="btn btn-primary" id="add-task-btn">+ Добавить задачу</button>
      </div>

      <div class="tasks-table-container">
        <table class="tasks-table">
          <thead>
            <tr>
              <th class="col-name">Название</th>
              <th class="col-description">Описание</th>
              <th class="col-status">Статус</th>
              <th class="col-date">Создана</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${activeTasks.length > 0 ? activeTasks.map(task => this.renderTaskRow(task, 'active')).join('') : ''}
            ${revisionTasks.length > 0 ? revisionTasks.map(task => this.renderTaskRow(task, 'revision')).join('') : ''}
            ${completedTasks.length > 0 ? completedTasks.map(task => this.renderTaskRow(task, 'completed')).join('') : ''}
          </tbody>
        </table>
      </div>
    `;

    // Обработчики
    const backBtn = this.container.querySelector('#back-to-projects-btn');
    backBtn?.addEventListener('click', () => this.onBack());

    const addTaskBtn = this.container.querySelector('#add-task-btn');
    addTaskBtn?.addEventListener('click', () => this.onAddTask());

    // Клики по задачам
    this.container.querySelectorAll('.task-row').forEach(row => {
      const taskId = (row as HTMLElement).dataset.taskId;
      if (taskId) {
        row.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.task-actions')) return;
          this.onTaskClick(taskId);
        });
      }
    });

    // Редактирование
    this.container.querySelectorAll('.edit-task-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = (e.target as HTMLElement).closest('.task-row') as HTMLElement;
        const taskId = row?.dataset.taskId;
        if (taskId && this.currentProject) {
          const task = this.currentProject.taskItems.find(t => t.id === taskId);
          if (task) this.onTaskEdit(task);
        }
      });
    });

    // Удаление
    this.container.querySelectorAll('.delete-task-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = (e.target as HTMLElement).closest('.task-row') as HTMLElement;
        const taskId = row?.dataset.taskId;
        if (taskId && this.currentProject) {
          const task = this.currentProject.taskItems.find(t => t.id === taskId);
          if (task && confirm(`Удалить задачу "${task.title}"?`)) {
            this.onTaskDelete(task);
          }
        }
      });
    });
  }

  private renderTaskRow(task: TaskItem, status: TaskStatus): string {
    const statusLabel = this.getStatusLabel(status);

    return `
      <tr class="task-row" data-task-id="${task.id}">
        <td class="task-name">${this.escapeHtml(task.title)}</td>
        <td class="task-description">${this.escapeHtml(task.description) || '—'}</td>
        <td class="task-status">${statusLabel}</td>
        <td class="task-date">${boardService.formatDateTime(task.createdAt)}</td>
        <td class="task-actions">
          <button class="task-action-btn edit-task-item-btn" title="Редактировать задачу">✏️</button>
          <button class="task-action-btn delete-task-item-btn" title="Удалить задачу">🗑️</button>
        </td>
      </tr>
    `;
  }

  private getStatusLabel(status: TaskStatus): string {
    switch (status) {
      case 'active': return 'Ждёт выполнения';
      case 'completed': return 'Завершено';
      case 'revision': return 'На доработке';
      default: return status;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refresh(): Promise<void> {
    if (this.currentProject) {
      await this.render(this.currentProject.id);
    }
  }
}
