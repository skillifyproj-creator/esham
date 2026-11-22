namespace esham.BLL.Interfaces;
public interface ICompletionMutationGate
{
    Task<bool> IsEnabledAsync(CancellationToken ct = default);
}
