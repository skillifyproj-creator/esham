import { courseRequest } from './curriculumApi.js';
export const loadAdminOverview = signal => courseRequest('/admin/overview', undefined, 'GET', signal);
export const loadAdminCategories = signal => courseRequest('/admin/categories', undefined, 'GET', signal);
export const loadCategoryAdministrators = signal => courseRequest('/admin/category-admins', undefined, 'GET', signal);
export const loadCategoryAssignments = (id, signal) => courseRequest(`/admin/categories/${encodeURIComponent(id)}/assignments`, undefined, 'GET', signal);
export const saveCategoryAssignments = (id, userIds, expectedVersion) => courseRequest(`/admin/categories/${encodeURIComponent(id)}/assignments`, { userIds, expectedVersion }, 'PUT');
export const saveAdminCategory = (id, input) => courseRequest('/categories' + (id ? `/${encodeURIComponent(id)}` : ''), input, id ? 'PUT' : 'POST');
export const setAdminCategoryStatus = (id, isActive) => courseRequest(`/categories/${encodeURIComponent(id)}/status`, { isActive }, 'PATCH');

// The request contract deliberately has no role selector or existing-user identifier.
export const createCategoryAdministrator = ({ name, email, password, categoryIds }, request = courseRequest) =>
  request('/admin/users/category-admins', { name, email, password, categoryIds }, 'POST');
