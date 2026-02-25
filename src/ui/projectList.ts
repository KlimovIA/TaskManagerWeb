import { Project } from '../types/models';
import { boardService } from '../storage/boardService';

export class ProjectList {
  private container: HTMLElement;
  private onProjectClick: (projectId: string) => void;
  private onProjectEdit: (project: Project) => void;
  private onProjectDelete: (project: Project) => void;
  private onAddProject: () => void;

  constructor(
    container: HTMLElement,
    onProjectClick: (projectId: string) => void,
    onProjectEdit: (project: Project) => void,
    onProjectDelete: (project: Project) => void,
    onAddProject: () => void
  ) {
    this.container = container;
    this.onProjectClick = onProjectClick;
    this.onProjectEdit = onProjectEdit;
    this.onProjectDelete = onProjectDelete;
    this.onAddProject = onAddProject;
  }

  async render(): Promise<void> {
    const projects = await boardService.getProjects();

    if (projects.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state projects-empty">
          <p>Нет проектов</p>
          <button class="btn btn-primary" id="add-first-project-btn">+ Создать первый проект</button>
        </div>
      `;

      const addBtn = this.container.querySelector('#add-first-project-btn');
      addBtn?.addEventListener('click', () => this.onAddProject());
    } else {
      this.container.innerHTML = `
        <div class="projects-table-container">
          <table class="projects-table">
            <thead>
              <tr>
                <th class="col-name">Название</th>
                <th class="col-description">Описание</th>
                <th class="col-stat">В работе</th>
                <th class="col-stat">Завершено</th>
                <th class="col-stat">На доработке</th>
                <th class="col-stat">Всего</th>
                <th class="col-date">Обновлён</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              ${projects.map(project => this.renderProjectRow(project)).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Обработчики кликов по проектам
      this.container.querySelectorAll('.project-row').forEach(row => {
        const projectId = (row as HTMLElement).dataset.projectId;
        if (projectId) {
          row.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.project-actions')) return;
            this.onProjectClick(projectId);
          });
        }
      });

      // Обработчики редактирования
      this.container.querySelectorAll('.edit-project-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = (e.target as HTMLElement).closest('.project-row') as HTMLElement;
          const projectId = row?.dataset.projectId;
          if (projectId) {
            const project = projects.find(p => p.id === projectId);
            if (project) this.onProjectEdit(project);
          }
        });
      });

      // Обработчики удаления
      this.container.querySelectorAll('.delete-project-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = (e.target as HTMLElement).closest('.project-row') as HTMLElement;
          const projectId = row?.dataset.projectId;
          if (projectId) {
            const project = projects.find(p => p.id === projectId);
            if (project && confirm(`Удалить проект "${project.name}" и все его задачи?`)) {
              this.onProjectDelete(project);
            }
          }
        });
      });
    }
  }

  private renderProjectRow(project: Project): string {
    const activeTasksCount = project.taskItems.filter(t => t.status === 'active').length;
    const totalTasksCount = project.taskItems.length;
    const completedCount = project.taskItems.filter(t => t.status === 'completed').length;
    const revisionCount = project.taskItems.filter(t => t.status === 'revision').length;

    return `
      <tr class="project-row" data-project-id="${project.id}">
        <td class="project-name">${this.escapeHtml(project.name)}</td>
        <td class="project-description">${this.escapeHtml(project.description) || '—'}</td>
        <td class="project-stat stat-active">${activeTasksCount}</td>
        <td class="project-stat stat-completed">${completedCount}</td>
        <td class="project-stat stat-revision">${revisionCount}</td>
        <td class="project-stat stat-total">${totalTasksCount}</td>
        <td class="project-date">${boardService.formatDateTime(project.updatedAt)}</td>
        <td class="project-actions">
          <button class="project-action-btn edit-project-btn" title="Редактировать проект">✏️</button>
          <button class="project-action-btn delete-project-btn" title="Удалить проект">🗑️</button>
        </td>
      </tr>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
