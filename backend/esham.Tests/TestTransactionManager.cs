using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Storage;
namespace esham.Tests;

// InMemory exercises service rules only. This shim does NOT simulate SQL rollback,
// isolation or constraints. Hosted data is never used by these tests.
public sealed class TestTransactionManager : IRelationalTransactionManager
{
    public IDbContextTransaction? CurrentTransaction { get; private set; }
    public IDbContextTransaction BeginTransaction() => BeginTransaction(IsolationLevel.Serializable);
    public IDbContextTransaction BeginTransaction(IsolationLevel isolationLevel)
    {
        if (isolationLevel != IsolationLevel.Serializable) throw new InvalidOperationException("Serializable writes expected.");
        return CurrentTransaction = new TestTransaction();
    }
    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default) => Task.FromResult(BeginTransaction());
    public Task<IDbContextTransaction> BeginTransactionAsync(IsolationLevel level, CancellationToken ct = default) => Task.FromResult(BeginTransaction(level));
    public void CommitTransaction() => CurrentTransaction?.Commit();
    public Task CommitTransactionAsync(CancellationToken ct = default) { CommitTransaction(); return Task.CompletedTask; }
    public void RollbackTransaction() => CurrentTransaction?.Rollback();
    public Task RollbackTransactionAsync(CancellationToken ct = default) { RollbackTransaction(); return Task.CompletedTask; }
    public void ResetState() => CurrentTransaction = null;
    public Task ResetStateAsync(CancellationToken ct = default) { ResetState(); return Task.CompletedTask; }
    public IDbContextTransaction? UseTransaction(DbTransaction? transaction) => throw new NotSupportedException();
    public IDbContextTransaction? UseTransaction(DbTransaction? transaction, Guid id) => throw new NotSupportedException();
    public Task<IDbContextTransaction?> UseTransactionAsync(DbTransaction? transaction, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<IDbContextTransaction?> UseTransactionAsync(DbTransaction? transaction, Guid id, CancellationToken ct = default) => throw new NotSupportedException();
    private sealed class TestTransaction : IDbContextTransaction
    {
        public Guid TransactionId { get; } = Guid.NewGuid();
        public void Commit() { }
        public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Rollback() { }
        public Task RollbackAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Dispose() { }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
