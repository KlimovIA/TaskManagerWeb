/**
 * Статус задачи внутри проекта
 */
export type TaskStatus = 'active' | 'completed' | 'revision';

/**
 * Тип карточки (задачи канбан-доски)
 */
export type CardType = 
  | 'feature'        // Добавление функционала
  | 'bug'            // Баг
  | 'enhancement'    // Улучшение
  | 'docs'           // Документация
  | 'refactor'       // Рефакторинг
  | 'test'           // Тесты
  | 'ci'             // CI/CD
  | 'security'       // Безопасность
  | 'performance'    // Производительность
  | 'design'         // Дизайн
  | 'translation';   // Перевод

/**
 * Модель заметки по задаче
 */
export interface Note {
  id: string;
  title: string;      // Заголовок заметки (кратко)
  content: string;    // Полное содержание заметки
  createdAt: string;  // ISO-формат даты
}

/**
 * Типы операций для истории
 */
export type HistoryOperationType =
  | 'task_created'
  | 'task_moved'
  | 'task_updated'
  | 'task_deleted'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted';

/**
 * Запись истории операции
 */
export interface HistoryEntry {
  id: string;
  taskId: string;
  operationType: HistoryOperationType;
  description: string;
  timestamp: string; // ISO-формат даты
}

/**
 * Модель задачи (карточка канбан-доски)
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  stageId: string;
  cardTypes: CardType[];  // Типы карточек (может быть несколько)
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Модель задачи внутри проекта
 */
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  boardState?: BoardState;  // Состояние канбан-доски для этой задачи
  createdAt: string;
  updatedAt: string;
}

/**
 * Модель проекта
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  taskItems: TaskItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Модель этапа (колонки канбан-доски)
 */
export interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

/**
 * Полное состояние доски
 */
export interface BoardState {
  stages: Stage[];
  tasks: Task[];
  history: HistoryEntry[];
}
