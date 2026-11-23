// A view operation is tied to a verified identity epoch, including A -> B -> A.
// Refreshing the same account does not change that epoch.
export function beginAccountOperation(readSession, readView) {
  const origin = readSession(), view = readView();
  if (!origin?.accountId) return null;
  return {
    accountId: origin.accountId,
    isCurrent(profile) {
      const current = readSession();
      return current?.accountId === origin.accountId
        && current.generation === origin.generation && readView() === view
        && (profile === undefined || profile?.id === origin.accountId);
    },
  };
}
