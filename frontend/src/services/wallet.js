import { bindAccount, financialRequest, isGuid, validatePage, FinancialError } from './financialApi.js';
export async function loadWallet(accountId, request = financialRequest) {
  const data = bindAccount(await request('/me/wallet'), accountId);
  if (![data.balance, data.earned, data.spent].every(Number.isSafeInteger) || data.balance < 0) throw new FinancialError('response'); return data;
}
export async function loadWalletHistory(accountId, page = 1, request = financialRequest) {
  const data = validatePage(bindAccount(await request(`/me/wallet/transactions?page=${page}&pageSize=20`), accountId));
  if (data.items.some(x => !isGuid(x.id) || !Number.isInteger(x.amount) || x.amount === 0 || typeof x.transactionType !== 'string' || !Number.isFinite(Date.parse(x.createdAt)))) throw new FinancialError('response');
  return data;
}
export async function loadTeachingTotals(accountId, request = financialRequest) {
  const items = []; let page = 1, data;
  do {
    data = validatePage(bindAccount(await request(`/me/wallet/teaching-summary?page=${page}&pageSize=100`), accountId));
    if (data.page !== page || !Number.isSafeInteger(data.totalEarned) || data.items.some(x => !isGuid(x.courseId) || !Number.isSafeInteger(x.points))) throw new FinancialError('response');
    if (!data.items.length && items.length < data.totalCount) throw new FinancialError('response');
    items.push(...data.items); page++;
  } while (items.length < data.totalCount);
  return { items, totalEarned: data.totalEarned };
}
