import { Stage, Task, CardType } from '../types/models';
import { boardService } from '../storage/boardService';

export class StageRenderer {
  private onTaskClick: (taskId: string) => void;
  private onTaskDelete: (taskId: string) => void;
  private onStageEdit: (stage: Stage) => void;
  private onStageDelete: (stage: Stage) => void;
  private onAddTask: (stageId: string) => void;

  constructor(
    onTaskClick: (taskId: string) => void,
    onTaskDelete: (taskId: string) => void,
    onStageEdit: (stage: Stage) => void,
    onStageDelete: (stage: Stage) => void,
    onAddTask: (stageId: string) => void
  ) {
    this.onTaskClick = onTaskClick;
    this.onTaskDelete = onTaskDelete;
    this.onStageEdit = onStageEdit;
    this.onStageDelete = onStageDelete;
    this.onAddTask = onAddTask;
  }

  renderStage(stage: Stage, tasks: Task[]): HTMLElement {
    const stageEl = document.createElement('div');
    stageEl.className = 'stage';
    stageEl.dataset.stageId = stage.id;

    const tasksInStage = tasks.filter(t => t.stageId === stage.id);

    stageEl.innerHTML = `
      <div class="stage-header" style="background: ${stage.color}">
        <span class="stage-name">${this.escapeHtml(stage.name)} (${tasksInStage.length})</span>
        <div class="stage-actions">
          <button class="stage-btn edit-stage-btn" title="Редактировать этап">✏️</button>
          <button class="stage-btn delete-stage-btn" title="Удалить этап">🗑️</button>
        </div>
      </div>
      <div class="stage-content">
        ${tasksInStage.length > 0 
          ? tasksInStage.map(task => this.renderTaskCard(task, stage.color)).join('')
          : '<div class="empty-state">Нет задач</div>'
        }
      </div>
      <button class="add-task-btn">+ Добавить подзадачу</button>
    `;

    // Обработчики событий
    const editBtn = stageEl.querySelector('.edit-stage-btn');
    editBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onStageEdit(stage);
    });

    const deleteBtn = stageEl.querySelector('.delete-stage-btn');
    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Удалить этап "${stage.name}" и все его задачи?`)) {
        this.onStageDelete(stage);
      }
    });

    const addTaskBtn = stageEl.querySelector('.add-task-btn');
    addTaskBtn?.addEventListener('click', () => {
      this.onAddTask(stage.id);
    });

    // Обработчик удаления задачи
    stageEl.querySelectorAll('.task-card-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskCard = (e.target as HTMLElement).closest('.task-card') as HTMLElement;
        const taskId = taskCard.dataset.taskId;
        if (taskId) {
          this.onTaskDelete(taskId);
        }
      });
    });

    // Обработчик клика на карточку (открытие панели)
    stageEl.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        const taskId = (card as HTMLElement).dataset.taskId;
        if (taskId) {
          this.onTaskClick(taskId);
        }
      });
    });

    // Drag and Drop для этапа
    this.setupStageDragDrop(stageEl, stage.id);

    return stageEl;
  }

  private renderTaskCard(task: Task, stageColor: string): string {
    const notesCount = task.notes.length;
    const createdDate = boardService.formatDateTime(task.createdAt);
    const typesHtml = task.cardTypes.length > 0
      ? `<div class="task-card-types">${task.cardTypes.map(type => `<span class="task-card-type-badge" data-type="${type}">${this.getTypeLabel(type)}</span>`).join('')}</div>`
      : '';

    return `
      <div class="task-card" draggable="true" data-task-id="${task.id}" style="--stage-color: ${stageColor}">
        <button class="task-card-delete" title="Удалить задачу">&times;</button>
        <div class="task-card-title">${this.escapeHtml(task.title)}</div>
        ${typesHtml}
        <div class="task-card-meta">
          <span>${createdDate}</span>
          ${notesCount > 0 ? `<span class="task-card-notes">${notesCount}</span>` : ''}
        </div>
      </div>
    `;
  }

  private getTypeLabel(type: CardType): string {
    switch (type) {
      case 'feature': return 'Добавление функционала';
      case 'bug': return 'Баг';
      case 'enhancement': return 'Улучшение';
      case 'docs': return 'Документация';
      case 'refactor': return 'Рефакторинг';
      case 'test': return 'Тесты';
      case 'ci': return 'CI/CD';
      case 'security': return 'Безопасность';
      case 'performance': return 'Производительность';
      case 'design': return 'Дизайн';
      case 'translation': return 'Перевод';
      default: return type;
    }
  }

  private setupStageDragDrop(stageEl: HTMLElement, _stageId: string): void {
    const content = stageEl.querySelector('.stage-content');
    if (!content) return;

    content.addEventListener('dragover', ((e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      const draggingTask = document.querySelector('.task-card.dragging');
      if (draggingTask) {
        stageEl.classList.add('drag-over');

        // Определяем позицию для вставки
        const afterElement = this.getDragAfterElement(content, dragEvent.clientY);
        if (afterElement) {
          content.insertBefore(draggingTask, afterElement);
        } else {
          content.appendChild(draggingTask);
        }
      }
    }) as EventListener);

    content.addEventListener('dragleave', () => {
      stageEl.classList.remove('drag-over');
    });

    content.addEventListener('drop', ((e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      stageEl.classList.remove('drag-over');
    }) as EventListener);
  }

  private getDragAfterElement(container: Element, y: number): Element | null {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')] as Element[];

    type Closest = { offset: number; element: Element | null };
    
    const result = draggableElements.reduce((closest: Closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY, element: null });
    
    return result.element;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateTaskCount(stageEl: HTMLElement, count: number): void {
    const nameEl = stageEl.querySelector('.stage-name');
    if (nameEl) {
      const stage = this.getStageFromElement(stageEl);
      if (stage) {
        nameEl.textContent = `${stage.name} (${count})`;
      }
    }
  }

  private getStageFromElement(stageEl: HTMLElement): Stage | null {
    const stageId = stageEl.dataset.stageId;
    if (!stageId) return null;
    
    const header = stageEl.querySelector('.stage-header');
    if (!header) return null;
    
    const color = getComputedStyle(header).backgroundColor;
    const nameEl = stageEl.querySelector('.stage-name');
    const name = nameEl?.textContent?.replace(/ \(\d+\)$/, '') || '';
    
    return { id: stageId, name, color, order: 0 };
  }
}
