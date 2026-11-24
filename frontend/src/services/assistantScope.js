// Captured scopes also detect A -> B -> A switches and logout during asynchronous preparation.
export function assistantScope(account) {
  const id = account.session?.profile?.id || null, generation = account.sessionGeneration;
  return {
    accountId: id || 'guest',
    current: () => {
      const live = account.getSessionIdentity();
      return live.accountId === id && live.generation === generation;
    },
  };
}
