import { HistoryEntry } from '../types/models';
import { boardService } from '../storage/boardService';

export class HistoryPanel {
  private panel: HTMLElement | null = null;
  private historyList: HTMLElement | null = null;
  private currentTaskId: string | null = null;
  private onClearCallback: ((taskId: string) => Promise<void>) | null = null;
  private refreshTimeout: number | null = null;
  private eventListenersInitialized: boolean = false;

  constructor(onClearCallback?: (taskId: string) => Promise<void>) {
    this.onClearCallback = onClearCallback || null;
  }

  private ensureInitialized(): void {
    if (this.eventListenersInitialized) return;
    
    this.panel = document.getElementById('history-panel');
    this.historyList = document.getElementById('history-list');
    
    if (!this.panel || !this.historyList) {
      console.error('History panel elements not found');
      return;
    }
    
    this.setupEventListeners();
    this.eventListenersInitialized = true;
  }

  show(history: HistoryEntry[], taskId: string): void {
    this.ensureInitialized();
    this.currentTaskId = taskId;
    if (this.panel) {
      this.panel.classList.remove('hidden');
    }
    this.renderHistory(history);
  }

  hide(): void {
    if (this.panel) {
      this.panel.classList.add('hidden');
    }
    this.currentTaskId = null;
  }

  async refresh(taskId?: string): Promise<void> {
    // Отменяем предыдущий запланированный refresh
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    const id = taskId || this.currentTaskId;
    if (!id) return;

    // Debounce для предотвращения частых обновлений
    this.refreshTimeout = setTimeout(async () => {
      try {
        const history = await boardService.getTaskHistory(id);
        this.renderHistory(history);
      } catch (error) {
        console.error('Ошибка обновления истории:', error);
      }
      this.refreshTimeout = null;
    }, 100) as unknown as number;
  }

  async refreshImmediate(taskId?: string): Promise<void> {
    this.ensureInitialized();
    const id = taskId || this.currentTaskId;
    if (!id) return;

    try {
      const history = await boardService.getTaskHistory(id);
      this.renderHistory(history);
    } catch (error) {
      console.error('Ошибка обновления истории:', error);
    }
  }

  private renderHistory(history: HistoryEntry[]): void {
    if (!this.historyList) return;
    
    if (history.length === 0) {
      this.historyList.innerHTML = '<div class="empty-state">История пуста</div>';
      return;
    }

    this.historyList.innerHTML = history.map((entry, index) => {
      // Сначала выделяем текст в кавычках жирным и номера заметок
      const description = this.boldQuotedText(entry.description);
      const time = boardService.formatDateTime(entry.timestamp);
      return `
        <div class="history-item">
          <div class="history-item-number">${index + 1}</div>
          <div class="history-item-content">
            <div class="history-item-description">${description}</div>
          </div>
          <div class="history-item-time">${time}</div>
        </div>
      `;
    }).join('');
  }

  private boldQuotedText(text: string): string {
    // Сначала выделяем текст в кавычках жирным и номера заметок (до экранирования)
    let withBold = text.replace(/"([^"]+)"/g, '<strong>"$1"</strong>');
    // Выделяем номера заметок (№1, №2, etc.)
    withBold = withBold.replace(/№(\d+)/g, '<strong>№$1</strong>');
    
    // Затем экранируем HTML, но пропускаем теги strong
    const parts = withBold.split(/(<strong>.*?<\/strong>)/g);
    return parts.map(part => {
      if (part.startsWith('<strong>')) {
        return part; // Это уже HTML-тег, не экранируем
      }
      return this.escapeHtml(part);
    }).join('');
  }

  private setupEventListeners(): void {
    if (!this.panel) return;
    
    const closeBtn = this.panel.querySelector('#close-history-btn');
    const clearBtn = this.panel.querySelector('#clear-history-btn');

    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    clearBtn?.addEventListener('click', async () => {
      if (this.currentTaskId && this.onClearCallback) {
        if (confirm('Очистить историю операций для этой задачи?')) {
          try {
            await this.onClearCallback(this.currentTaskId);
            await this.refreshImmediate();
          } catch (error) {
            console.error('Error clearing history:', error);
          }
        }
      }
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
