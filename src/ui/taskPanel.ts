import { Task, Stage, Note } from '../types/models';
import { boardService } from '../storage/boardService';

export class TaskPanel {
  private panel: HTMLElement;
  private currentTask: Task | null = null;
  private stages: Stage[] = [];

  private onSaveCallback: (taskId: string, updates: { title?: string; description?: string; stageId?: string }) => Promise<void>;
  private onDeleteCallback: (taskId: string) => Promise<void>;
  private onAddNoteCallback: (taskId: string, title: string, content: string) => Promise<void>;
  private onUpdateNoteCallback: (taskId: string, noteId: string, content: string, title: string) => Promise<void>;
  private onDeleteNoteCallback: (taskId: string, noteId: string) => Promise<void>;
  private onViewHistoryCallback: (taskId: string) => void;
  private onCloseCallback: () => void;

  constructor(
    onSaveCallback: (taskId: string, updates: { title?: string; description?: string; stageId?: string }) => Promise<void>,
    onDeleteCallback: (taskId: string) => Promise<void>,
    onAddNoteCallback: (taskId: string, title: string, content: string) => Promise<void>,
    onUpdateNoteCallback: (taskId: string, noteId: string, content: string, title: string) => Promise<void>,
    onDeleteNoteCallback: (taskId: string, noteId: string) => Promise<void>,
    onViewHistoryCallback: (taskId: string) => void,
    onCloseCallback: () => void
  ) {
    this.panel = document.getElementById('task-panel')!;
    this.onSaveCallback = onSaveCallback;
    this.onDeleteCallback = onDeleteCallback;
    this.onAddNoteCallback = onAddNoteCallback;
    this.onUpdateNoteCallback = onUpdateNoteCallback;
    this.onDeleteNoteCallback = onDeleteNoteCallback;
    this.onViewHistoryCallback = onViewHistoryCallback;
    this.onCloseCallback = onCloseCallback;

    this.setupEventListeners();
  }

  setStages(stages: Stage[]): void {
    this.stages = stages;
    this.updateStageSelect();
  }

  show(task: Task): void {
    this.currentTask = task;
    this.panel.classList.remove('hidden');
    this.populateForm(task);
    this.updateStageSelect();
    this.renderNotes(task.notes);
  }

  hide(): void {
    this.panel.classList.add('hidden');
    this.currentTask = null;
  }

  private populateForm(task: Task): void {
    document.getElementById('task-panel-title')!.textContent = 'Настройки задачи';
    (document.getElementById('task-title')! as HTMLInputElement).value = task.title;
    (document.getElementById('task-description')! as HTMLTextAreaElement).value = task.description || '';
  }

  private updateStageSelect(): void {
    const select = document.getElementById('task-stage')! as HTMLSelectElement;
    select.innerHTML = this.stages.map(stage => 
      `<option value="${stage.id}" ${this.currentTask?.stageId === stage.id ? 'selected' : ''}>${this.escapeHtml(stage.name)}</option>`
    ).join('');
  }

  private renderNotes(notes: Note[]): void {
    const notesList = document.getElementById('notes-list')!;

    if (notes.length === 0) {
      notesList.innerHTML = '<div class="empty-state">Нет заметок</div>';
      return;
    }

    notesList.innerHTML = notes.map((note, index) => `
      <div class="note-item" data-note-id="${note.id}">
        <div class="note-item-header">
          <div class="note-item-title">
            <span class="note-item-number">№${index + 1}</span>
            <span class="note-item-date">${boardService.formatDateTime(note.createdAt)}</span>
          </div>
          <div class="note-item-actions">
            <button class="edit-note-btn" title="Редактировать">✏️</button>
            <button class="delete-note-btn" title="Удалить">🗑️</button>
          </div>
        </div>
        <div class="note-item-text" title="${this.escapeHtml(note.content)}">${this.escapeHtml(note.title || 'Без названия')}</div>
      </div>
    `).join('');

    // Обработчики для заметок
    notesList.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteItem = (e.target as HTMLElement).closest('.note-item') as HTMLElement;
        const noteId = noteItem.dataset.noteId!;
        this.openNoteModal(noteId);
      });
    });

    notesList.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteItem = (e.target as HTMLElement).closest('.note-item') as HTMLElement;
        const noteId = noteItem.dataset.noteId!;
        const note = this.currentTask?.notes.find(n => n.id === noteId);
        if (note && confirm(`Удалить заметку "${note.title}"?`)) {
          this.deleteNote(noteId);
        }
      });
    });

    // Клик по тексту заметки открывает модальное окно
    notesList.querySelectorAll('.note-item-text').forEach(el => {
      el.addEventListener('click', () => {
        const noteItem = (el as HTMLElement).closest('.note-item') as HTMLElement;
        const noteId = noteItem.dataset.noteId!;
        this.openNoteModal(noteId);
      });
    });
  }

  private openNoteModal(noteId: string): void {
    if (!this.currentTask) return;
    
    const note = this.currentTask.notes.find(n => n.id === noteId);
    if (!note) return;

    const modal = document.getElementById('note-modal');
    const titleInput = document.getElementById('note-title-input') as HTMLInputElement;
    const contentInput = document.getElementById('note-content-input') as HTMLTextAreaElement;
    const modalTitle = document.getElementById('note-modal-title');

    if (!modal || !titleInput || !contentInput || !modalTitle) return;

    titleInput.value = note.title || '';
    contentInput.value = note.content || '';

    modal.classList.remove('hidden');

    // Сохранение заметки
    const saveBtn = document.getElementById('save-note-btn');
    const cancelBtn = document.getElementById('cancel-note-btn');

    const closeAndSave = async () => {
      const newTitle = titleInput.value.trim() || 'Без названия';
      const newContent = contentInput.value;

      if (newContent !== note.content || newTitle !== note.title) {
        if (this.currentTask) {
          await this.onUpdateNoteCallback(this.currentTask.id, noteId, newContent, newTitle);
          this.currentTask = await boardService.getTaskById(this.currentTask.id) || null;
          if (this.currentTask) {
            this.renderNotes(this.currentTask.notes);
          }
        }
      }

      modal.classList.add('hidden');
      saveBtn?.removeEventListener('click', closeAndSave);
      cancelBtn?.removeEventListener('click', closeModal);
    };

    const closeModal = () => {
      modal.classList.add('hidden');
      saveBtn?.removeEventListener('click', closeAndSave);
      cancelBtn?.removeEventListener('click', closeModal);
    };

    saveBtn?.addEventListener('click', closeAndSave);
    cancelBtn?.addEventListener('click', closeModal);
  }

  private async deleteNote(noteId: string): Promise<void> {
    if (!this.currentTask) return;
    
    await this.onDeleteNoteCallback(this.currentTask.id, noteId);
    // Обновляем задачу
    this.currentTask = await boardService.getTaskById(this.currentTask.id) || null;
    if (this.currentTask) {
      this.renderNotes(this.currentTask.notes);
    }
  }

  private setupEventListeners(): void {
    // Закрытие панели
    document.getElementById('close-panel-btn')!.addEventListener('click', () => {
      this.onCloseCallback();
    });

    // Сохранение изменений задачи (автоматически при изменении полей)
    const titleInput = document.getElementById('task-title')! as HTMLInputElement;
    const descriptionInput = document.getElementById('task-description')! as HTMLTextAreaElement;
    const stageSelect = document.getElementById('task-stage')! as HTMLSelectElement;

    let debounceTimer: number | undefined;
    const debouncedSave = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.saveChanges(), 500) as unknown as number;
    };

    titleInput.addEventListener('input', debouncedSave);
    descriptionInput.addEventListener('input', debouncedSave);
    stageSelect.addEventListener('change', () => this.saveChanges());

    // Добавление заметки
    const addNoteBtn = document.getElementById('add-note-btn')!;

    const openAddNoteModal = async () => {
      const modal = document.getElementById('note-modal');
      const titleInput = document.getElementById('note-title-input') as HTMLInputElement;
      const contentInput = document.getElementById('note-content-input') as HTMLTextAreaElement;
      const modalTitle = document.getElementById('note-modal-title');

      if (!modal || !titleInput || !contentInput || !modalTitle) return;

      modalTitle.textContent = 'Новая заметка';
      titleInput.value = '';
      contentInput.value = '';
      modal.classList.remove('hidden');

      const saveBtn = document.getElementById('save-note-btn');
      const cancelBtn = document.getElementById('cancel-note-btn');

      const saveNewNote = async () => {
        const title = titleInput.value.trim() || 'Без названия';
        const content = contentInput.value.trim();

        if (content && this.currentTask) {
          await this.onAddNoteCallback(this.currentTask.id, title, content);
          this.currentTask = await boardService.getTaskById(this.currentTask.id) || null;
          if (this.currentTask) {
            this.renderNotes(this.currentTask.notes);
          }
        }

        modal.classList.add('hidden');
        saveBtn?.removeEventListener('click', saveNewNote);
        cancelBtn?.removeEventListener('click', closeModal);
      };

      const closeModal = () => {
        modal.classList.add('hidden');
        saveBtn?.removeEventListener('click', saveNewNote);
        cancelBtn?.removeEventListener('click', closeModal);
      };

      saveBtn?.addEventListener('click', saveNewNote);
      cancelBtn?.addEventListener('click', closeModal);
    };

    addNoteBtn.addEventListener('click', openAddNoteModal);

    // Просмотр истории
    document.getElementById('view-history-btn')!.addEventListener('click', () => {
      if (this.currentTask) {
        this.onViewHistoryCallback(this.currentTask.id);
      }
    });

    // Удаление задачи
    document.getElementById('delete-task-btn')!.addEventListener('click', async () => {
      if (this.currentTask && confirm(`Удалить задачу "${this.currentTask.title}"?`)) {
        await this.onDeleteCallback(this.currentTask.id);
        this.hide();
      }
    });
  }

  private async saveChanges(): Promise<void> {
    if (!this.currentTask) return;

    const titleInput = document.getElementById('task-title')! as HTMLInputElement;
    const descriptionInput = document.getElementById('task-description')! as HTMLTextAreaElement;
    const stageSelect = document.getElementById('task-stage')! as HTMLSelectElement;

    const updates: { title?: string; description?: string; stageId?: string } = {};
    
    if (titleInput.value !== this.currentTask.title) {
      updates.title = titleInput.value.trim();
    }
    if (descriptionInput.value !== this.currentTask.description) {
      updates.description = descriptionInput.value;
    }
    if (stageSelect.value !== this.currentTask.stageId) {
      updates.stageId = stageSelect.value;
    }

    if (Object.keys(updates).length > 0) {
      await this.onSaveCallback(this.currentTask.id, updates);
      // Обновляем текущую задачу
      this.currentTask = await boardService.getTaskById(this.currentTask.id) || null;
    }
  }

  refreshCurrentTask(): void {
    if (this.currentTask) {
      boardService.getTaskById(this.currentTask.id).then(task => {
        if (task) {
          this.currentTask = task;
          this.populateForm(task);
          this.renderNotes(task.notes);
        }
      });
    }
  }

  getCurrentTask(): Task | null {
    return this.currentTask;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
