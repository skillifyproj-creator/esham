import { courseRequest } from './curriculumApi.js';
export const taskPath = courseId => `/courses/${courseId}/draft/tasks`;
export const loadTasks = (courseId, signal) => courseRequest(taskPath(courseId), undefined, 'GET', signal);
export const loadTask = (courseId, taskId, signal) => courseRequest(`${taskPath(courseId)}/${taskId}`, undefined, 'GET', signal);
export const saveTask = (courseId, taskId, payload) => courseRequest(`${taskPath(courseId)}${taskId ? `/${taskId}` : ''}`, payload, taskId ? 'PUT' : 'POST');
export const deleteTask = (courseId, taskId) => courseRequest(`${taskPath(courseId)}/${taskId}`, undefined, 'DELETE');
export const reorderTasks = (courseId, ids) => courseRequest(`${taskPath(courseId)}/reorder`, { ids }, 'PUT');
export const loadTaskReadiness = (courseId, signal) => courseRequest(`${taskPath(courseId)}/readiness`, undefined, 'GET', signal);
